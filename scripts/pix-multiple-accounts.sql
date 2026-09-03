-- =============================================================================
-- Múltiplas contas Pix — dízimos/ofertas padrão e chave por campanha
-- =============================================================================
-- app_parameters (EAV por tenant, compatível com chave_pix):
--   chave_pix                  conta 1 (já existente)
--   chave_pix_secundaria       conta 2
--   nome_conta_pix_1           rótulo amigável da conta 1
--   nome_conta_pix_2           rótulo amigável da conta 2
--   chave_pix_padrao_ofertas   '1' | '2' — padrão de dízimos e ofertas gerais
-- campaign_projects.chave_pix_selecionada  '1' | '2'
-- Isolamento: tenant_id da sessão. Escrita: super_admin, tesoureiro, secretaria
--   ou quem tem update em maintenance.card.financials.
-- Aplica: npx supabase db query --linked -f scripts/pix-multiple-accounts.sql
-- =============================================================================

alter table public.campaign_projects
  add column if not exists chave_pix_selecionada text not null default '1';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'campaign_projects_chave_pix_selecionada_check'
  ) then
    alter table public.campaign_projects
      add constraint campaign_projects_chave_pix_selecionada_check
      check (chave_pix_selecionada in ('1', '2'));
  end if;
end
$$;

comment on column public.campaign_projects.chave_pix_selecionada is
  'Qual conta Pix de app_parameters receberá a campanha: 1 = chave_pix, 2 = chave_pix_secundaria.';

update public.campaign_projects
   set chave_pix_selecionada = '1'
 where chave_pix_selecionada is null
    or chave_pix_selecionada not in ('1', '2');

-- Rótulos e padrão por tenant (não sobrescreve valor já gravado).
insert into public.app_parameters (parameter, value, tenant_id)
select seed.parameter, seed.value, i.id
  from public.igrejas i
 cross join (
    values
      ('nome_conta_pix_1', 'Conta principal'),
      ('nome_conta_pix_2', 'Conta secundária'),
      ('chave_pix_padrao_ofertas', '1'),
      ('chave_pix_secundaria', '')
  ) as seed(parameter, value)
 where i.is_active = true
   and not exists (
     select 1
       from public.app_parameters ap
      where ap.tenant_id = i.id
        and lower(trim(ap.parameter)) = lower(seed.parameter)
   );

create or replace function public.normalize_pix_account_slot(p_slot text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(p_slot, ''))) in ('2', 'secundaria', 'chave_pix_secundaria')
      then '2'
    else '1'
  end;
$$;

create or replace function public.session_can_manage_pix_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.session_has_screen_access('maintenance.card.financials', 'update')
    or public.session_has_screen_access('maintenance.finance.campaigns', 'update')
    or exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = public.current_session_profile_id()
         and ar.code in ('secretaria', 'tesoureiro')
    ),
    false
  );
$$;

grant execute on function public.session_can_manage_pix_accounts() to anon, authenticated;

create or replace function public.read_tenant_app_parameter(p_tenant uuid, p_parameter text)
returns text
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_value text;
begin
  if p_tenant is null or nullif(trim(p_parameter), '') is null then
    return null;
  end if;

  select nullif(trim(ap.value), '')
    into v_value
    from public.app_parameters ap
   where ap.tenant_id = p_tenant
     and lower(trim(ap.parameter)) = lower(trim(p_parameter))
   order by
     case when ap.parameter = trim(p_parameter) then 0 else 1 end,
     ap.parameter
   limit 1;

  return v_value;
end;
$$;

create or replace function public.resolve_tenant_pix_key(p_tenant uuid, p_slot text)
returns text
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_slot text := public.normalize_pix_account_slot(p_slot);
  v_pix text;
begin
  if p_tenant is null then
    return null;
  end if;

  if v_slot = '2' then
    v_pix := public.read_tenant_app_parameter(p_tenant, 'chave_pix_secundaria');
  else
    v_pix := public.read_tenant_app_parameter(p_tenant, 'chave_pix');

    if v_pix is null then
      select nullif(trim(i.pix_key), '')
        into v_pix
        from public.igrejas i
       where i.id = p_tenant;
    end if;
  end if;

  return v_pix;
end;
$$;

create or replace function public.tenant_pix_accounts_json(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_label_1 text;
  v_label_2 text;
  v_default text;
begin
  v_label_1 := coalesce(public.read_tenant_app_parameter(p_tenant, 'nome_conta_pix_1'), 'Conta principal');
  v_label_2 := coalesce(public.read_tenant_app_parameter(p_tenant, 'nome_conta_pix_2'), 'Conta secundária');
  v_default := public.normalize_pix_account_slot(
    public.read_tenant_app_parameter(p_tenant, 'chave_pix_padrao_ofertas')
  );

  if public.resolve_tenant_pix_key(p_tenant, v_default) is null then
    v_default := case
      when public.resolve_tenant_pix_key(p_tenant, '2') is not null then '2'
      else '1'
    end;
  end if;

  return jsonb_build_object(
    'default_slot', v_default,
    'accounts', jsonb_build_array(
      jsonb_build_object(
        'slot', '1',
        'label', v_label_1,
        'pix_key', public.resolve_tenant_pix_key(p_tenant, '1')
      ),
      jsonb_build_object(
        'slot', '2',
        'label', v_label_2,
        'pix_key', public.resolve_tenant_pix_key(p_tenant, '2')
      )
    )
  );
end;
$$;

create or replace function public.get_session_pix_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_payload jsonb;
begin
  if v_profile_id is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_can_use_tenant(v_profile_id, v_tenant) then
    return jsonb_build_object('success', false, 'message', 'Sem acesso a esta igreja.');
  end if;

  v_payload := public.tenant_pix_accounts_json(v_tenant);
  v_payload := v_payload || jsonb_build_object(
    'success', true,
    'can_manage', public.session_can_manage_pix_accounts()
  );

  return v_payload;
end;
$$;

grant execute on function public.get_session_pix_accounts() to anon, authenticated;

create or replace function public.upsert_tenant_app_parameter(
  p_tenant uuid,
  p_parameter text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_parameter text := trim(coalesce(p_parameter, ''));
  v_value text := trim(coalesce(p_value, ''));
begin
  if p_tenant is null or v_parameter = '' then
    return;
  end if;

  update public.app_parameters
     set value = v_value,
         parameter = v_parameter
   where tenant_id = p_tenant
     and lower(trim(parameter)) = lower(v_parameter);

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values (v_parameter, v_value, p_tenant);
  end if;
end;
$$;

create or replace function public.salvar_pix_accounts_admin(
  p_nome_conta_1 text default null,
  p_chave_pix_1 text default null,
  p_nome_conta_2 text default null,
  p_chave_pix_2 text default null,
  p_padrao_ofertas text default '1'
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
  v_padrao text := public.normalize_pix_account_slot(p_padrao_ofertas);
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.session_can_manage_pix_accounts() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para configurar contas Pix.');
  end if;

  perform public.upsert_tenant_app_parameter(
    v_tenant,
    'nome_conta_pix_1',
    coalesce(nullif(trim(p_nome_conta_1), ''), 'Conta principal')
  );
  perform public.upsert_tenant_app_parameter(
    v_tenant,
    'chave_pix',
    coalesce(p_chave_pix_1, '')
  );
  perform public.upsert_tenant_app_parameter(
    v_tenant,
    'nome_conta_pix_2',
    coalesce(nullif(trim(p_nome_conta_2), ''), 'Conta secundária')
  );
  perform public.upsert_tenant_app_parameter(
    v_tenant,
    'chave_pix_secundaria',
    coalesce(p_chave_pix_2, '')
  );
  perform public.upsert_tenant_app_parameter(
    v_tenant,
    'chave_pix_padrao_ofertas',
    v_padrao
  );

  return public.get_session_pix_accounts() || jsonb_build_object(
    'success', true,
    'message', 'Contas Pix salvas.'
  );
end;
$$;

grant execute on function public.salvar_pix_accounts_admin(text, text, text, text, text)
  to anon, authenticated;

-- Recebedor de dízimos/ofertas usa a chave padrão da engrenagem.
create or replace function public.get_session_offerings_recipient(p_tenant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_row record;
  v_accounts jsonb;
  v_slot text;
  v_pix text;
begin
  if v_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Igreja ativa não encontrada. Selecione a instância novamente.'
    );
  end if;

  if not public.profile_can_use_tenant(v_profile_id, v_tenant) then
    return jsonb_build_object('success', false, 'message', 'Sem acesso a esta igreja.');
  end if;

  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.cnpj), '') as cnpj,
    nullif(trim(i.pix_institution), '') as pix_institution
  into v_row
  from public.igrejas i
  where i.id = v_tenant
    and i.is_active = true;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada ou inativa.');
  end if;

  v_accounts := public.tenant_pix_accounts_json(v_tenant);
  v_slot := coalesce(v_accounts->>'default_slot', '1');
  v_pix := public.resolve_tenant_pix_key(v_tenant, v_slot);

  return jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'code', v_row.code,
    'name', v_row.name,
    'cnpj', v_row.cnpj,
    'pix_institution', v_row.pix_institution,
    'pix_key', v_pix,
    'pix_slot', v_slot,
    'pix_accounts', v_accounts->'accounts',
    'pix_default_slot', v_slot
  );
end;
$$;

grant execute on function public.get_session_offerings_recipient(uuid)
  to anon, authenticated;

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

  return jsonb_build_object(
    'id', p_row.id,
    'titulo', p_row.titulo,
    'descricao', p_row.descricao,
    'meta_financeira', p_row.meta_financeira,
    'valor_arrecadado', p_row.valor_arrecadado,
    'data_inicio', p_row.data_inicio,
    'data_fim', p_row.data_fim,
    'status', p_row.status,
    'centavos_referencia', p_row.centavos_referencia,
    'cover_url', p_row.cover_url,
    'chave_pix_selecionada', public.normalize_pix_account_slot(p_row.chave_pix_selecionada),
    'progress_pct', v_pct,
    'donations_count', v_donations,
    'unique_donors', greatest(v_donations, v_intents),
    'velocity_per_day', round(p_row.valor_arrecadado / v_days, 2)
  );
end;
$$;

drop function if exists public.upsert_campaign_project(uuid, text, text, numeric, date, date, text, numeric, text);

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
  p_chave_pix_selecionada text default '1'
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
  v_slot text := public.normalize_pix_account_slot(p_chave_pix_selecionada);
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

  if p_id is null then
    if coalesce(trim(p_titulo), '') = '' or p_meta_financeira is null or p_meta_financeira <= 0 then
      return jsonb_build_object('success', false, 'message', 'Informe título e meta financeira.');
    end if;

    insert into public.campaign_projects (
      tenant_id, titulo, descricao, meta_financeira, data_inicio, data_fim,
      status, centavos_referencia, cover_url, chave_pix_selecionada, created_by_profile_id
    ) values (
      v_tenant,
      trim(p_titulo),
      coalesce(trim(p_descricao), ''),
      p_meta_financeira,
      coalesce(p_data_inicio, (timezone('America/Sao_Paulo', now()))::date),
      p_data_fim,
      v_status,
      v_cents,
      nullif(trim(coalesce(p_cover_url, '')), ''),
      v_slot,
      v_actor
    )
    returning * into v_row;
  else
    update public.campaign_projects c
       set titulo = coalesce(nullif(trim(coalesce(p_titulo, '')), ''), c.titulo),
           descricao = coalesce(p_descricao, c.descricao),
           meta_financeira = coalesce(p_meta_financeira, c.meta_financeira),
           data_inicio = coalesce(p_data_inicio, c.data_inicio),
           data_fim = p_data_fim,
           status = v_status,
           centavos_referencia = v_cents,
           cover_url = case
             when p_cover_url is null then c.cover_url
             when trim(p_cover_url) = '' then null
             else trim(p_cover_url)
           end,
           chave_pix_selecionada = v_slot,
           updated_at = now()
     where c.id = p_id
       and c.tenant_id = v_tenant
    returning * into v_row;

    if v_row.id is null then
      return jsonb_build_object('success', false, 'message', 'Campanha não encontrada.');
    end if;
  end if;

  v_id := v_row.id;
  perform public.reconcile_campaign_deposits(v_tenant);
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
  uuid, text, text, numeric, date, date, text, numeric, text, text
) to anon, authenticated;

-- Secretaria configura Pix por projeto sem abrir o ledger financeiro.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.finance.campaigns'
 where r.code = 'secretaria'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

notify pgrst, 'reload schema';
