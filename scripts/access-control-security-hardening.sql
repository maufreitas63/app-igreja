-- Correções de segurança RBAC (C*, A*, M7) — execute após access-control-schema.sql
-- e scripts incrementais já aplicados no projeto.
--
-- Ordem sugerida no Supabase SQL Editor:
--   1. access-control-schema.sql (se ainda não aplicado)
--   2. access-control-table-rls.sql
--   3. Este arquivo

-- ===========================================================================
-- C1 + C5: Sessão e sondagem ACL
-- ===========================================================================

create or replace function public.assert_actor_matches_session(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if public.current_session_profile_id() is null then
    raise exception 'Sessão não identificada. Saia e entre novamente no aplicativo.';
  end if;

  if p_actor_profile_id <> public.current_session_profile_id() then
    raise exception 'Sessão inconsistente com o perfil informado.';
  end if;
end;
$$;

create or replace function public.assert_session_profile_matches(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if public.current_session_profile_id() is null then
    raise exception 'Sessão não identificada.';
  end if;

  if p_profile_id <> public.current_session_profile_id() then
    raise exception 'Operação permitida apenas para o perfil da sessão atual.';
  end if;
end;
$$;

create or replace function public.is_super_admin_profile(p_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  if p_profile_id is null then
    return false;
  end if;

  v_session := public.current_session_profile_id();

  if v_session is not null and p_profile_id <> v_session then
    if not exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = v_session
         and ar.code = 'super_admin'
    ) then
      return false;
    end if;
  end if;

  return exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = 'super_admin'
  );
end;
$$;

create or replace function public.assert_access_admin(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.is_super_admin_profile(p_actor_profile_id) then
    raise exception 'Apenas super administradores podem gerenciar permissões.';
  end if;
end;
$$;

create or replace function public.role_has_access(
  p_role_code text,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
begin
  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return false;
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_roles ar
        on ar.id = g.role_id
       and ar.code = lower(trim(coalesce(p_role_code, '')))
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
  )
    into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.profile_has_access(
  p_profile_id uuid,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
  v_has_roles boolean;
  v_session uuid;
begin
  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  v_session := public.current_session_profile_id();

  if p_profile_id is not null
     and v_session is not null
     and p_profile_id <> v_session
     and not public.is_super_admin_profile(v_session) then
    return false;
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return false;
  end if;

  if p_profile_id is null then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
       and (
         g.profile_id = p_profile_id
         or g.role_id in (
           select par.role_id
             from public.profile_access_roles par
            where par.profile_id = p_profile_id
         )
       )
  )
    into v_allowed;

  if coalesce(v_allowed, false) then
    return true;
  end if;

  select exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
  )
    into v_has_roles;

  if not coalesce(v_has_roles, false) then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  return false;
end;
$$;

-- ===========================================================================
-- A5 + painéis manutenção: recursos e grants por papel
-- ===========================================================================

insert into public.access_resources (resource_type, resource_key, label, description)
values
  ('screen', 'maintenance.card.events', 'Manutenção — Programação de eventos', null),
  ('screen', 'maintenance.card.events_gantt', 'Manutenção — Cronograma de eventos', null),
  ('screen', 'maintenance.card.sala_monitor', 'Manutenção — Monitor de salas', null),
  ('screen', 'maintenance.card.quorum_presence', 'Manutenção — Lista de presença (quórum)', null),
  ('screen', 'maintenance.card.financials', 'Manutenção — Informações financeiras', null),
  ('screen', 'maintenance.card.profile_cadastro', 'Manutenção — Cadastro / Recepção familiar', null)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'events_admin'
   and res.resource_type = 'screen'
   and res.resource_key in (
     'maintenance.card.events',
     'maintenance.card.events_gantt',
     'maintenance.card.sala_monitor',
     'maintenance.card.quorum_presence'
   )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'family_acceptor'
   and (
     (res.resource_type = 'screen' and res.resource_key in ('/manage-members', 'dashboard.card.members_list'))
     or (res.resource_type = 'table' and res.resource_key = 'members')
   )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'family_acceptor'
   and res.resource_type = 'table'
   and res.resource_key = 'members'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ===========================================================================
-- C2: RPCs financeiras de manutenção
-- ===========================================================================

create or replace function public.listar_lancamentos_financeiros_periodo(
  p_periodo text,
  p_referencia date
)
returns table (
  id uuid,
  transaction_date date,
  account text,
  amount numeric,
  ministry text,
  transaction_kind text,
  movement text,
  budget_version text,
  comments text,
  receipt_url text,
  source_row integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.session_has_resource_access('table', 'financials', 'view')
    or public.session_has_screen_access('maintenance.card.financials', 'view')
  ) then
    return;
  end if;

  return query
  with bounds as (
    select b.start_date, b.end_date_exclusive
    from public.financials_period_bounds(p_periodo, p_referencia) b
  )
  select
    f.id,
    f.transaction_date,
    f.account,
    f.amount,
    f.ministry,
    f.transaction_kind,
    f.movement,
    f.budget_version,
    f.comments,
    f.receipt_url,
    f.source_row,
    f.created_at,
    f.updated_at
  from public.financials f
  cross join bounds b
  where f.transaction_date >= b.start_date
    and f.transaction_date < b.end_date_exclusive
  order by
    f.transaction_kind asc,
    f.transaction_date asc,
    f.account asc,
    f.movement asc,
    f.ministry asc;
end;
$$;

create or replace function public.cadastrar_lancamento_financeiro(
  p_transaction_date date,
  p_account text,
  p_amount numeric,
  p_ministry text,
  p_transaction_kind text,
  p_movement text,
  p_budget_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_account text;
  v_ministry text;
  v_transaction_kind text;
  v_movement text;
  v_budget_version text;
begin
  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para incluir lançamentos financeiros.');
  end if;

  if p_transaction_date is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data do lançamento.');
  end if;

  v_account := trim(coalesce(p_account, ''));
  v_ministry := trim(coalesce(p_ministry, ''));
  v_transaction_kind := trim(coalesce(p_transaction_kind, ''));
  v_movement := trim(coalesce(p_movement, ''));
  v_budget_version := trim(coalesce(p_budget_version, ''));

  if v_account = '' or v_ministry = '' or v_transaction_kind = '' or v_movement = '' or v_budget_version = '' then
    return jsonb_build_object('success', false, 'message', 'Preencha todos os campos obrigatórios.');
  end if;

  if p_amount is null then
    return jsonb_build_object('success', false, 'message', 'Informe o valor.');
  end if;

  insert into public.financials (
    transaction_date, account, amount, ministry, transaction_kind, movement, budget_version
  )
  values (
    p_transaction_date, v_account, p_amount, v_ministry, v_transaction_kind, v_movement, v_budget_version
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'message', 'Lançamento incluído.', 'id', v_id);
end;
$$;

create or replace function public.excluir_lancamento_financeiro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir lançamentos financeiros.');
  end if;

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  delete from public.financials f where f.id = p_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi apagado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Lançamento excluído.');
end;
$$;

create or replace function public.excluir_lancamentos_financeiros_periodo(
  p_periodo text,
  p_referencia date,
  p_budget_version text default 'REALIZADO'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
  v_periodo text;
  v_budget_version text;
begin
  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir lançamentos financeiros.');
  end if;

  v_periodo := lower(trim(coalesce(p_periodo, '')));
  v_budget_version := upper(trim(coalesce(p_budget_version, '')));

  if v_periodo not in ('dia', 'mes') then
    return jsonb_build_object('success', false, 'message', 'Período inválido. Use dia ou mes.');
  end if;

  if p_referencia is null or v_budget_version = '' then
    return jsonb_build_object('success', false, 'message', 'Informe referência e versão do período.');
  end if;

  delete from public.financials f
  using public.financials_period_bounds(p_periodo, p_referencia) b
  where f.transaction_date >= b.start_date
    and f.transaction_date < b.end_date_exclusive
    and upper(trim(f.budget_version)) = v_budget_version;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'success', true,
    'message', format('%s lançamento(s) removido(s).', v_deleted),
    'deleted_count', v_deleted
  );
end;
$$;

-- ===========================================================================
-- C4: Diretórios do mapa
-- ===========================================================================

create or replace function public.list_profiles_members_directory()
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  family_id text,
  is_visitantes_only boolean,
  cep text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.session_has_screen_access('/mapa-geolocalizacao', 'view') then
    return;
  end if;

  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      nullif(trim(coalesce(p.family_id, '')), ''),
      nullif(trim(coalesce(p.codigo_membro, '')), '')
    ) as family_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and not public.profile_is_visitantes_only(p.id)
  order by trim(p.full_name) asc;
end;
$$;

create or replace function public.list_profiles_visitors_directory()
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  family_id text,
  is_visitantes_only boolean,
  cep text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.session_has_screen_access('/mapa-geolocalizacao', 'view') then
    return;
  end if;

  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      nullif(trim(coalesce(p.family_id, '')), ''),
      nullif(trim(coalesce(p.codigo_membro, '')), '')
    ) as family_id,
    true as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and public.profile_is_visitantes_only(p.id)
  order by trim(p.full_name) asc;
end;
$$;

create or replace function public.list_profiles_visitantes_only_flags()
returns table (
  profile_id uuid,
  is_visitantes_only boolean,
  role_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.session_has_screen_access('/mapa-geolocalizacao', 'view') then
    return;
  end if;

  return query
  select
    p.id as profile_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    public.profile_map_role_label(p.id) as role_label
  from public.profiles p;
end;
$$;

create or replace function public.fetch_profiles_acl_sync_fingerprint()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.session_has_screen_access('/mapa-geolocalizacao', 'view') then
    return jsonb_build_object('allowed', false);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'generated_at', now()
  );
end;
$$;

-- ===========================================================================
-- A2: Pastoral — amarra à sessão (insert: pastoral-requests-fields.sql)
-- ===========================================================================

create or replace function public.list_my_pastoral_requests(p_profile_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  motivo text,
  situacao text,
  description text,
  destination_label text,
  request_for text,
  beneficiary_name text,
  beneficiary_relationship text,
  beneficiary_details text,
  status text,
  confidential boolean,
  handler_profile_id uuid,
  handler_name text,
  cancellation_requested_at timestamptz,
  cancellation_request_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_phone_digits text;
begin
  perform public.assert_session_profile_matches(p_profile_id);

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id;

  return query
  select
    pr.id,
    pr.created_at,
    pr.motivo,
    pr.situacao,
    pr.description,
    pr.destination_label,
    pr.request_for,
    pr.beneficiary_name,
    pr.beneficiary_relationship,
    pr.beneficiary_details,
    pr.status::text,
    coalesce(pr.confidential, false),
    pr.handler_profile_id,
    nullif(trim(coalesce(pr.handler_name, '')), '') as handler_name,
    pr.cancellation_requested_at,
    nullif(trim(coalesce(pr.cancellation_request_reason, '')), '') as cancellation_request_reason
  from public.pastoral_requests pr
  where pr.profile_id = p_profile_id
    or (
      v_profile_phone_digits <> ''
      and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
    )
  order by pr.created_at desc;
end;
$$;

create or replace function public.request_my_pastoral_cancellation(
  p_request_id uuid,
  p_profile_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_phone_digits text;
  v_request public.pastoral_requests%rowtype;
  v_status text;
  v_follow_up_idx integer;
  v_reason text;
begin
  perform public.assert_session_profile_matches(p_profile_id);

  if p_request_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id;

  select * into v_request
  from public.pastoral_requests pr
  where pr.id = p_request_id
    and (
      pr.profile_id = p_profile_id
      or (
        v_profile_phone_digits <> ''
        and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
      )
    );

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;

  v_status := lower(trim(coalesce(v_request.status::text, '')));
  v_follow_up_idx := public.pastoral_follow_up_stage_index(v_request.status::text);

  if v_follow_up_idx < 0 and v_status not in ('in_progress', 'closed', 'cancelled') then
    return jsonb_build_object(
      'success', false,
      'message', 'Este pedido ainda pode ser excluído diretamente, sem solicitar cancelamento.'
    );
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_reason is null or length(v_reason) < 3 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe uma justificativa com pelo menos 3 caracteres.'
    );
  end if;

  if v_request.cancellation_requested_at is not null then
    return jsonb_build_object(
      'success', true,
      'message', 'Cancelamento já solicitado. Aguarde o Cuidado Pastoral.',
      'cancellation_requested_at', v_request.cancellation_requested_at,
      'cancellation_request_reason', v_request.cancellation_request_reason
    );
  end if;

  update public.pastoral_requests pr
  set cancellation_requested_at = now(),
      cancellation_request_reason = v_reason,
      updated_at = now()
  where pr.id = p_request_id;

  return jsonb_build_object('success', true, 'message', 'Solicitação de cancelamento enviada ao Cuidado Pastoral.');
end;
$$;

-- ===========================================================================
-- A4: Recepção familiar
-- ===========================================================================

drop policy if exists recepcao_cadastro_familiar_lote_select on public.recepcao_cadastro_familiar_lote;
create policy recepcao_cadastro_familiar_lote_select
  on public.recepcao_cadastro_familiar_lote
  for select
  to anon, authenticated
  using (
    public.session_has_screen_access('maintenance.card.profile_cadastro', 'view')
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists recepcao_cadastro_familiar_select on public.recepcao_cadastro_familiar;
create policy recepcao_cadastro_familiar_select
  on public.recepcao_cadastro_familiar
  for select
  to anon, authenticated
  using (
    public.session_has_screen_access('maintenance.card.profile_cadastro', 'view')
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

-- ===========================================================================
-- A3 + M7: Escalas, checkins e quórum
-- ===========================================================================

drop policy if exists checkins_select_public on public.checkins;
create policy checkins_select_acl
  on public.checkins
  for select
  to anon, authenticated
  using (
    profile_id = public.current_session_profile_id()
    or public.session_has_screen_access('maintenance.card.quorum_presence', 'view')
    or public.session_has_resource_access('table', 'event_registrations', 'update')
  );

drop policy if exists event_quorum_registry_select_public on public.event_quorum_registry;
create policy event_quorum_registry_select_acl
  on public.event_quorum_registry
  for select
  to anon, authenticated
  using (
    profile_id = public.current_session_profile_id()
    or public.session_has_screen_access('maintenance.card.quorum_presence', 'view')
    or public.session_has_resource_access('table', 'events', 'update')
  );

alter table public.voluntarios_escala enable row level security;
alter table public.escalas_log enable row level security;
alter table public.tipos_escala enable row level security;

drop policy if exists voluntarios_escala_select_acl on public.voluntarios_escala;
create policy voluntarios_escala_select_acl
  on public.voluntarios_escala
  for select
  to anon, authenticated
  using (public.session_has_resource_access('table', 'voluntarios_escala', 'view'));

drop policy if exists voluntarios_escala_write_acl on public.voluntarios_escala;
create policy voluntarios_escala_write_acl
  on public.voluntarios_escala
  for all
  to anon, authenticated
  using (public.session_has_resource_access('table', 'voluntarios_escala', 'update'))
  with check (public.session_has_resource_access('table', 'voluntarios_escala', 'update'));

drop policy if exists escalas_log_select_acl on public.escalas_log;
create policy escalas_log_select_acl
  on public.escalas_log
  for select
  to anon, authenticated
  using (public.session_has_resource_access('table', 'escalas_log', 'view'));

drop policy if exists escalas_log_write_acl on public.escalas_log;
create policy escalas_log_write_acl
  on public.escalas_log
  for all
  to anon, authenticated
  using (public.session_has_resource_access('table', 'escalas_log', 'update'))
  with check (public.session_has_resource_access('table', 'escalas_log', 'update'));

drop policy if exists tipos_escala_select_acl on public.tipos_escala;
create policy tipos_escala_select_acl
  on public.tipos_escala
  for select
  to anon, authenticated
  using (public.session_has_resource_access('table', 'tipos_escala', 'view'));

drop policy if exists tipos_escala_write_acl on public.tipos_escala;
create policy tipos_escala_write_acl
  on public.tipos_escala
  for all
  to anon, authenticated
  using (public.session_has_resource_access('table', 'tipos_escala', 'update'))
  with check (public.session_has_resource_access('table', 'tipos_escala', 'update'));

grant execute on function public.assert_actor_matches_session(uuid) to anon, authenticated;
grant execute on function public.assert_session_profile_matches(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
