-- =============================================================================
-- Saldo de abertura das campanhas (já arrecadado fora do aplicativo)
-- =============================================================================
-- Campanhas em andamento entram no app com o montante prévio; o % e a barra
-- usam valor_inicial + depósitos conciliados.
-- Aplica: npx supabase db query --linked -f scripts/campaign-opening-balance.sql
-- =============================================================================

alter table public.campaign_projects
  add column if not exists valor_inicial numeric(14, 2) not null default 0;

alter table public.campaign_projects
  drop constraint if exists campaign_projects_valor_inicial_check;

alter table public.campaign_projects
  add constraint campaign_projects_valor_inicial_check
  check (valor_inicial >= 0);

comment on column public.campaign_projects.valor_inicial is
  'Montante já arrecadado antes do lançamento no aplicativo (campanhas em andamento). Soma-se aos depósitos conciliados em valor_arrecadado.';

create or replace function public.refresh_campaign_project_totals(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_sum numeric(14, 2);
  v_inicial numeric(14, 2);
  v_total numeric(14, 2);
begin
  select coalesce(sum(abs(f.amount)), 0)
    into v_sum
    from public.financials f
   where f.campaign_project_id = p_campaign_id
     and upper(trim(f.budget_version)) like '%REALIZ%'
     and upper(trim(f.transaction_kind)) like '%ENTRAD%';

  select coalesce(valor_inicial, 0)
    into v_inicial
    from public.campaign_projects
   where id = p_campaign_id;

  v_total := round(coalesce(v_inicial, 0) + coalesce(v_sum, 0), 2);

  update public.campaign_projects
     set valor_arrecadado = v_total,
         updated_at = now(),
         status = case
           when status = 'ativo' and meta_financeira > 0 and v_total >= meta_financeira
             then 'concluido'
           else status
         end
   where id = p_campaign_id;
end;
$$;

create or replace function public.campaign_project_json(p_row public.campaign_projects)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_donations integer := 0;
  v_intents integer := 0;
  v_days numeric := 1;
  v_pct numeric := 0;
  v_bank public.bank_accounts%rowtype;
  v_deposits numeric := 0;
begin
  select count(*)::integer
    into v_donations
    from public.financials f
   where f.campaign_project_id = p_row.id
     and upper(trim(f.budget_version)) like '%REALIZ%'
     and upper(trim(f.transaction_kind)) like '%ENTRAD%';

  select count(*)::integer
    into v_intents
    from public.campaign_contribution_intents i
   where i.campaign_id = p_row.id;

  v_days := greatest(
    1,
    (coalesce(p_row.data_fim, (timezone('America/Sao_Paulo', now()))::date)
      - p_row.data_inicio) + 1
  );
  v_pct := case
    when p_row.meta_financeira > 0
      then round((p_row.valor_arrecadado / p_row.meta_financeira) * 100, 1)
    else 0
  end;
  v_deposits := greatest(0, coalesce(p_row.valor_arrecadado, 0) - coalesce(p_row.valor_inicial, 0));

  v_bank := public.resolve_tenant_bank_account(p_row.tenant_id, p_row.bank_account_id);

  return jsonb_build_object(
    'id', p_row.id,
    'titulo', p_row.titulo,
    'descricao', p_row.descricao,
    'meta_financeira', p_row.meta_financeira,
    'valor_inicial', coalesce(p_row.valor_inicial, 0),
    'valor_arrecadado', p_row.valor_arrecadado,
    'data_inicio', p_row.data_inicio,
    'data_fim', p_row.data_fim,
    'status', p_row.status,
    'centavos_referencia', p_row.centavos_referencia,
    'cover_url', p_row.cover_url,
    'bank_account_id', v_bank.id,
    'chave_pix_selecionada', v_bank.id,
    'pix_key', nullif(trim(v_bank.pix_key), ''),
    'pix_institution', coalesce(nullif(trim(v_bank.institution), ''), nullif(trim(v_bank.label), '')),
    'holder_name', nullif(trim(v_bank.holder_name), ''),
    'document', nullif(trim(v_bank.document), ''),
    'agency', nullif(trim(v_bank.agency), ''),
    'account_number', nullif(trim(v_bank.account_number), ''),
    'account_type', v_bank.account_type,
    'progress_pct', v_pct,
    'donations_count', v_donations,
    'unique_donors', greatest(v_donations, v_intents),
    'velocity_per_day', round(v_deposits / v_days, 2)
  );
end;
$$;

drop function if exists public.upsert_campaign_project(uuid, text, text, numeric, date, date, text, numeric, text, text, uuid);

create or replace function public.upsert_campaign_project(
  p_id uuid default null,
  p_titulo text default null,
  p_descricao text default '',
  p_meta_financeira numeric default null,
  p_data_inicio date default null,
  p_data_fim date default null,
  p_status text default 'rascunho',
  p_centavos_referencia numeric default null,
  p_cover_url text default null,
  p_chave_pix_selecionada text default null,
  p_bank_account_id uuid default null,
  p_valor_inicial numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_status text := lower(trim(coalesce(p_status, 'rascunho')));
  v_cents numeric(4, 2);
  v_meta numeric(14, 2);
  v_bank uuid := p_bank_account_id;
  v_inicial numeric(14, 2);
  v_id uuid;
  v_row public.campaign_projects%rowtype;
begin
  if v_actor is null or not public.session_can_manage_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerir campanhas.');
  end if;

  if not (
    public.is_super_admin_profile(v_actor)
    or public.profile_has_access(
      v_actor,
      'screen',
      'maintenance.finance.campaigns',
      'update'
    )
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar campanhas.');
  end if;

  if v_status not in ('rascunho', 'ativo', 'concluido') then
    v_status := 'rascunho';
  end if;

  v_cents := round(coalesce(p_centavos_referencia, 0.01), 2);

  if v_cents < 0.01 or v_cents > 0.99 then
    return jsonb_build_object('success', false, 'message', 'Informe os centavos de referência entre 0,01 e 0,99.');
  end if;

  v_meta := case
    when p_meta_financeira is null or p_meta_financeira <= 0 then null
    else round(p_meta_financeira, 2)
  end;

  v_inicial := case
    when p_valor_inicial is null then null
    when p_valor_inicial < 0 then 0
    else round(p_valor_inicial, 2)
  end;

  if v_bank is null and p_chave_pix_selecionada ~* '^[0-9a-f-]{32,36}$' then
    begin
      v_bank := p_chave_pix_selecionada::uuid;
    exception
      when others then
        v_bank := null;
    end;
  end if;

  if v_bank is not null
     and not exists (
       select 1 from public.bank_accounts b
        where b.id = v_bank and b.tenant_id = v_tenant
     ) then
    return jsonb_build_object('success', false, 'message', 'Conta bancária inválida para esta igreja.');
  end if;

  if p_id is null then
    if coalesce(trim(p_titulo), '') = '' then
      return jsonb_build_object('success', false, 'message', 'Informe o título da campanha.');
    end if;

    insert into public.campaign_projects (
      tenant_id, titulo, descricao, meta_financeira, valor_inicial, data_inicio, data_fim,
      status, centavos_referencia, cover_url, bank_account_id, created_by_profile_id
    ) values (
      v_tenant,
      trim(p_titulo),
      coalesce(trim(p_descricao), ''),
      v_meta,
      coalesce(v_inicial, 0),
      coalesce(p_data_inicio, (timezone('America/Sao_Paulo', now()))::date),
      p_data_fim,
      v_status,
      v_cents,
      nullif(trim(coalesce(p_cover_url, '')), ''),
      v_bank,
      v_actor
    )
    returning * into v_row;
  else
    update public.campaign_projects c
       set titulo = coalesce(nullif(trim(coalesce(p_titulo, '')), ''), c.titulo),
           descricao = coalesce(p_descricao, c.descricao),
           meta_financeira = v_meta,
           valor_inicial = coalesce(v_inicial, c.valor_inicial),
           data_inicio = coalesce(p_data_inicio, c.data_inicio),
           data_fim = p_data_fim,
           status = v_status,
           centavos_referencia = v_cents,
           cover_url = case
             when p_cover_url is null then c.cover_url
             when trim(p_cover_url) = '' then null
             else trim(p_cover_url)
           end,
           bank_account_id = v_bank,
           updated_at = now()
     where c.id = p_id
       and c.tenant_id = v_tenant
    returning * into v_row;

    if v_row.id is null then
      return jsonb_build_object('success', false, 'message', 'Campanha não encontrada.');
    end if;
  end if;

  v_id := v_row.id;
  perform public.refresh_campaign_project_totals(v_id);
  perform public.reconcile_campaign_deposits(v_tenant);
  perform public.refresh_campaign_project_totals(v_id);
  select * into v_row from public.campaign_projects where id = v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'campaign', public.campaign_project_json(v_row));
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe uma campanha ativa/rascunho com estes centavos de referência.'
    );
end;
$$;

grant execute on function public.upsert_campaign_project(
  uuid, text, text, numeric, date, date, text, numeric, text, text, uuid, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';
