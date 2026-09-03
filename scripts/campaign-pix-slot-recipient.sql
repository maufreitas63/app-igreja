-- =============================================================================
-- Instituição Pix por conta (slot 1 / slot 2) na doação de campanha
-- =============================================================================
-- A campanha já escolhe chave_pix_selecionada; o recebedor na tela do membro
-- ainda mostrava igrejas.pix_institution (sempre a conta 1).
-- Aplica: npx supabase db query --linked -f scripts/campaign-pix-slot-recipient.sql
-- =============================================================================

alter table public.igrejas
  add column if not exists pix_institution_secundaria text;

comment on column public.igrejas.pix_institution_secundaria is
  'Instituição da chave Pix secundária (slot 2).';

update public.igrejas i
   set pix_institution_secundaria = ap.value
  from public.app_parameters ap
 where ap.tenant_id = i.id
   and lower(trim(ap.parameter)) = 'nome_conta_pix_2'
   and nullif(trim(ap.value), '') is not null
   and lower(trim(ap.value)) not in ('conta secundária', 'conta secundaria')
   and nullif(trim(coalesce(i.pix_institution_secundaria, '')), '') is null;

create or replace function public.resolve_tenant_pix_institution(p_tenant uuid, p_slot text)
returns text
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_slot text := public.normalize_pix_account_slot(p_slot);
  v_inst text;
  v_label text;
begin
  if p_tenant is null then
    return null;
  end if;

  if v_slot = '2' then
    select nullif(trim(i.pix_institution_secundaria), '')
      into v_inst
      from public.igrejas i
     where i.id = p_tenant;

    if v_inst is null then
      v_label := public.read_tenant_app_parameter(p_tenant, 'nome_conta_pix_2');
      if v_label is not null
         and lower(v_label) not in ('conta secundária', 'conta secundaria') then
        v_inst := v_label;
      end if;
    end if;
  else
    select nullif(trim(i.pix_institution), '')
      into v_inst
      from public.igrejas i
     where i.id = p_tenant;

    if v_inst is null then
      v_label := public.read_tenant_app_parameter(p_tenant, 'nome_conta_pix_1');
      if v_label is not null
         and lower(v_label) not in ('conta principal') then
        v_inst := v_label;
      end if;
    end if;
  end if;

  return v_inst;
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
        'pix_key', public.resolve_tenant_pix_key(p_tenant, '1'),
        'institution', public.resolve_tenant_pix_institution(p_tenant, '1')
      ),
      jsonb_build_object(
        'slot', '2',
        'label', v_label_2,
        'pix_key', public.resolve_tenant_pix_key(p_tenant, '2'),
        'institution', public.resolve_tenant_pix_institution(p_tenant, '2')
      )
    )
  );
end;
$$;

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
    nullif(trim(i.cnpj), '') as cnpj
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
    'pix_institution', public.resolve_tenant_pix_institution(v_tenant, v_slot),
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
  v_slot text := public.normalize_pix_account_slot(p_row.chave_pix_selecionada);
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
    'chave_pix_selecionada', v_slot,
    'pix_key', public.resolve_tenant_pix_key(p_row.tenant_id, v_slot),
    'pix_institution', public.resolve_tenant_pix_institution(p_row.tenant_id, v_slot),
    'progress_pct', v_pct,
    'donations_count', v_donations,
    'unique_donors', greatest(v_donations, v_intents),
    'velocity_per_day', round(p_row.valor_arrecadado / v_days, 2)
  );
end;
$$;

drop function if exists public.set_igreja_offerings_admin(uuid, text, text, text);
drop function if exists public.set_igreja_offerings_admin(uuid, text, text, text, text);

create or replace function public.set_igreja_offerings_admin(
  p_tenant_id uuid,
  p_cnpj text,
  p_pix_institution text,
  p_pix_key text,
  p_pix_key_secundaria text default null,
  p_pix_institution_secundaria text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_cnpj text := nullif(trim(coalesce(p_cnpj, '')), '');
  v_inst text := nullif(trim(coalesce(p_pix_institution, '')), '');
  v_pix text := nullif(trim(coalesce(p_pix_key, '')), '');
  v_pix_2 text := nullif(trim(coalesce(p_pix_key_secundaria, '')), '');
  v_inst_2 text := nullif(trim(coalesce(p_pix_institution_secundaria, '')), '');
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;

  if p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não informada.');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  update public.igrejas
     set cnpj = v_cnpj,
         pix_institution = v_inst,
         pix_key = v_pix,
         pix_key_secundaria = v_pix_2,
         pix_institution_secundaria = v_inst_2,
         updated_at = now()
   where id = p_tenant_id;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  if v_pix is not null then
    update public.app_parameters
       set value = v_pix
     where tenant_id = p_tenant_id
       and lower(trim(parameter)) = 'chave_pix';

    if not found then
      insert into public.app_parameters (parameter, value, tenant_id)
      values ('chave_pix', v_pix, p_tenant_id);
    end if;
  end if;

  update public.app_parameters
     set value = coalesce(v_pix_2, '')
   where tenant_id = p_tenant_id
     and lower(trim(parameter)) = 'chave_pix_secundaria';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('chave_pix_secundaria', coalesce(v_pix_2, ''), p_tenant_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'cnpj', v_cnpj,
    'pix_institution', v_inst,
    'pix_key', v_pix,
    'pix_key_secundaria', v_pix_2,
    'pix_institution_secundaria', v_inst_2,
    'message', 'Dados de dízimos/ofertas atualizados.'
  );
end;
$$;

grant execute on function public.set_igreja_offerings_admin(uuid, text, text, text, text, text)
  to anon, authenticated;

drop function if exists public.list_admin_igrejas();

create function public.list_admin_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  logo_url text,
  website_url text,
  instagram_url text,
  youtube_url text,
  cnpj text,
  pix_institution text,
  pix_key text,
  pix_key_secundaria text,
  pix_institution_secundaria text,
  is_active boolean,
  is_primary boolean,
  is_linked boolean,
  mae_tenant_id uuid,
  mae_code text,
  mae_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := public.current_session_profile_id();
begin
  if v_profile_id is null then
    return;
  end if;

  if not public.profile_has_super_admin_role(v_profile_id) then
    return;
  end if;

  return query
  select
    q.id,
    q.code,
    q.name,
    q.logo_url,
    q.website_url,
    q.instagram_url,
    q.youtube_url,
    q.cnpj,
    q.pix_institution,
    q.pix_key,
    q.pix_key_secundaria,
    q.pix_institution_secundaria,
    q.is_active,
    q.is_primary,
    q.is_linked,
    q.mae_tenant_id,
    q.mae_code,
    q.mae_name
  from (
    select
      i.id,
      i.code,
      i.name,
      nullif(trim(i.logo_url), '') as logo_url,
      nullif(trim(i.website_url), '') as website_url,
      nullif(trim(i.instagram_url), '') as instagram_url,
      nullif(trim(i.youtube_url), '') as youtube_url,
      nullif(trim(i.cnpj), '') as cnpj,
      nullif(trim(i.pix_institution), '') as pix_institution,
      nullif(trim(i.pix_key), '') as pix_key,
      nullif(trim(i.pix_key_secundaria), '') as pix_key_secundaria,
      nullif(trim(i.pix_institution_secundaria), '') as pix_institution_secundaria,
      i.is_active,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked,
      i.mae_tenant_id,
      mae.code as mae_code,
      mae.name as mae_name
    from public.igrejas i
    left join public.igrejas mae on mae.id = i.mae_tenant_id
    left join public.profile_igreja_vinculos v
      on v.tenant_id = i.id
     and v.profile_id = v_profile_id
     and v.is_active = true
  ) q
  order by q.is_active desc, q.is_primary desc, q.name asc;
end;
$$;

grant execute on function public.list_admin_igrejas() to anon, authenticated;

notify pgrst, 'reload schema';
