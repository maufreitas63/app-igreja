-- =============================================================================
-- Multi-tenancy — onda 4b: geofence / quorum / ciclo de escala (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   geo-checkin-automatic.sql / geo-checkin-geofence-ativo-event-patch.sql
--   geo-checkin-geofence-tempo-patch.sql / geo-checkin-favorite-locations-patch.sql
--   geo-checkin-purge-on-event-update.sql
--   events-quorum-registry.sql / checkins-totem-flow.sql
--   escalas-apply-cycle-batch.sql
-- Triggers trg_purge_*: só delegam aos helpers — patch dos helpers basta.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. assert_event_geofence_checkin_enabled
-- Fonte: geo-checkin-geofence-ativo-event-patch.sql / geo-checkin-automatic.sql
-- ---------------------------------------------------------------------------
create or replace function public.assert_event_geofence_checkin_enabled(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_enabled boolean;
begin
  select coalesce(e.geofence_ativo, false)
    into v_enabled
  from public.events e
  where e.tenant_id = v_tenant
    and e.id = p_event_id;

  if not found then
    raise exception 'Evento não encontrado.';
  end if;

  if not v_enabled then
    raise exception 'Check-in por proximidade não está habilitado para este evento.';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. assert_geofence_checkin_time_window
-- Fonte: geo-checkin-geofence-tempo-patch.sql / geo-checkin-automatic.sql
-- ---------------------------------------------------------------------------
create or replace function public.assert_geofence_checkin_time_window(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_event_date timestamptz;
  v_hours_before integer;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_event_day date;
begin
  select e.event_date
    into v_event_date
  from public.events e
  where e.tenant_id = v_tenant
    and e.id = p_event_id;

  if not found then
    raise exception 'Evento não encontrado.';
  end if;

  if v_event_date is null then
    raise exception 'Evento sem data para validar janela de check-in por proximidade.';
  end if;

  v_hours_before := public.geo_checkin_hours_before();
  v_window_start := v_event_date - make_interval(hours => v_hours_before);
  v_event_day := (v_event_date at time zone 'America/Sao_Paulo')::date;
  v_window_end := ((v_event_day + 1)::timestamp at time zone 'America/Sao_Paulo') - interval '1 second';

  if now() < v_window_start then
    raise exception 'Check-in por proximidade ainda não está disponível para este evento.';
  end if;

  if now() > v_window_end then
    raise exception 'O período de check-in por proximidade já encerrou para este evento.';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. family_has_geo_checkin_at_event
-- Fonte: geo-checkin-automatic.sql
-- ---------------------------------------------------------------------------
create or replace function public.family_has_geo_checkin_at_event(
  p_event_id uuid,
  p_family_group_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.checkins c
    join public.event_registrations er on er.id = c.event_registration_id
    where er.tenant_id = public.require_session_tenant_id()
      and c.tenant_id = er.tenant_id
      and er.event_id = p_event_id
      and er.family_id = trim(p_family_group_id)
      and c.status in ('pre_checkin', 'confirmado')
  );
$$;

grant execute on function public.family_has_geo_checkin_at_event(uuid, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. resolve_event_geofence_coordinates
-- Fonte: geo-checkin-automatic.sql (normalize_location_key)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_event_geofence_coordinates(p_event_id uuid)
returns table (
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fl.latitude,
    fl.longitude
  from public.events e
  join public.event_favorite_locations fl
    on public.normalize_location_key(fl.name) = public.normalize_location_key(e.event_local)
   and fl.tenant_id = e.tenant_id
   and coalesce(fl.is_active, true) is true
  where e.tenant_id = public.require_session_tenant_id()
    and e.id = p_event_id
    and nullif(trim(coalesce(e.event_local, '')), '') is not null
    and fl.latitude is not null
    and fl.longitude is not null
  order by fl.sort_order asc, fl.name asc
  limit 1;
$$;

comment on function public.resolve_event_geofence_coordinates(uuid) is
  'Geofence: coordenadas do evento a partir do local favorito vinculado por event_local (tenant-scoped).';

grant execute on function public.resolve_event_geofence_coordinates(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5–6. purge_event_checkins_for_geofence_event / purge_confirmed_checkins_...
-- Fonte: geo-checkin-purge-on-event-update.sql
-- Tenant vem da linha do evento (triggers podem não ter sessão).
-- ---------------------------------------------------------------------------
create or replace function public.purge_event_checkins_for_geofence_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_session uuid;
  v_deleted integer;
begin
  if not public.session_can_purge_geofence_event_checkins() then
    raise exception 'Não autorizado a invalidar check-ins do evento.';
  end if;

  select e.tenant_id
    into v_tenant
  from public.events e
  where e.id = p_event_id;

  if v_tenant is null then
    return 0;
  end if;

  v_session := public.current_session_tenant_id();
  if v_session is not null and v_session is distinct from v_tenant then
    raise exception 'Evento fora do tenant da sessão.';
  end if;

  delete from public.checkins c
  where c.tenant_id = v_tenant
    and c.event_id = p_event_id;

  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

create or replace function public.purge_confirmed_checkins_for_geofence_event(p_event_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.purge_event_checkins_for_geofence_event(p_event_id);
$$;

revoke all on function public.purge_event_checkins_for_geofence_event(uuid) from public, anon, authenticated;
revoke all on function public.purge_confirmed_checkins_for_geofence_event(uuid) from public, anon, authenticated;

grant execute on function public.purge_event_checkins_for_geofence_event(uuid) to service_role;
grant execute on function public.purge_confirmed_checkins_for_geofence_event(uuid) to service_role;


-- ---------------------------------------------------------------------------
-- 7. purge_geofence_checkins_for_events_matching_location
-- Fonte: geo-checkin-purge-on-event-update.sql
-- p_tenant_id opcional: triggers passam NEW/OLD.tenant_id; sessão usa require_*.
-- ---------------------------------------------------------------------------
drop function if exists public.purge_geofence_checkins_for_events_matching_location(text);

create or replace function public.purge_geofence_checkins_for_events_matching_location(
  p_location_name text,
  p_tenant_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  v_tenant := coalesce(p_tenant_id, public.require_session_tenant_id());

  delete from public.checkins c
  where c.tenant_id = v_tenant
    and c.event_id in (
      select e.id
      from public.events e
      where e.tenant_id = v_tenant
        and coalesce(e.geofence_ativo, false) = true
        and public.normalize_location_key(e.event_local) = public.normalize_location_key(p_location_name)
    );
end;
$$;


-- ---------------------------------------------------------------------------
-- 8. purge_geofence_checkins_on_event_update
-- Fonte: geo-checkin-purge-on-event-update.sql
-- ---------------------------------------------------------------------------
create or replace function public.purge_geofence_checkins_on_event_update(
  p_old public.events,
  p_new public.events
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  v_tenant := coalesce(p_new.tenant_id, p_old.tenant_id);

  if v_tenant is null then
    return;
  end if;

  if coalesce(p_old.geofence_ativo, false) is not true
     and coalesce(p_new.geofence_ativo, false) is not true then
    return;
  end if;

  if not public.geofence_event_has_checkin_relevant_changes(p_old, p_new) then
    return;
  end if;

  -- purge_event_checkins_for_geofence_event resolve tenant via events.id
  perform public.purge_event_checkins_for_geofence_event(p_old.id);
end;
$$;


-- ---------------------------------------------------------------------------
-- 9. purge_geofence_checkins_on_favorite_location_change
-- Fonte: geo-checkin-purge-on-event-update.sql
-- ---------------------------------------------------------------------------
create or replace function public.purge_geofence_checkins_on_favorite_location_change(
  p_old public.event_favorite_locations,
  p_new public.event_favorite_locations,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_tenant uuid;
begin
  if p_operation = 'DELETE' then
    v_tenant := p_old.tenant_id;
  else
    v_tenant := coalesce(p_new.tenant_id, p_old.tenant_id);
  end if;

  if v_tenant is null then
    return;
  end if;

  if p_operation = 'UPDATE'
     and not public.favorite_location_has_geofence_relevant_changes(p_old, p_new) then
    return;
  end if;

  foreach v_name in array array[p_old.name, case when p_operation = 'UPDATE' then p_new.name end]
  loop
    if v_name is not null then
      perform public.purge_geofence_checkins_for_events_matching_location(v_name, v_tenant);
    end if;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- trg_purge_*: só chamam os helpers acima — sem query direta em checkins/events.
-- ---------------------------------------------------------------------------
-- NOTICE: triggers trg_purge_event_checkins_on_geofence_event_update /
-- trg_purge_confirmed_checkins_on_geofence_event_update /
-- trg_purge_event_checkins_on_favorite_location_change /
-- trg_purge_confirmed_checkins_on_favorite_location_update
-- não precisam de patch de corpo (delegam aos helpers 8–9).
do $$ begin
  raise notice 'wave4b: skipped trg_purge_* (helpers only; no direct checkins/events DML)';
end $$;


-- ---------------------------------------------------------------------------
-- 10. backfill_event_quorum_registry
-- Fonte: events-quorum-registry.sql
-- ---------------------------------------------------------------------------
create or replace function public.backfill_event_quorum_registry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select er.event_id, er.id as registration_id, er.profile_id
    from public.event_registrations er
    inner join public.events e on e.id = er.event_id and e.tenant_id = er.tenant_id
    where er.tenant_id = v_tenant
      and coalesce(e.requer_quorum, false) = true
      and er.profile_id is not null
  loop
    perform public.sync_quorum_registry_for_registration(
      v_row.event_id,
      v_row.registration_id,
      v_row.profile_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.backfill_event_quorum_registry() to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 11. ensure_event_quorum_registry
-- Fonte: events-quorum-registry.sql
-- DDL preservado; isolamento de tenant via backfill (DML).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_event_quorum_registry()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_events_requer_quorum_column();

  create table if not exists public.event_quorum_registry (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events (id) on delete cascade,
    event_registration_id uuid references public.event_registrations (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    checkin_id uuid references public.checkins (id) on delete set null,
    event_name text not null,
    event_date date,
    event_local text,
    max_capacity integer,
    participant_name text,
    participant_phone text,
    participant_email text,
    participant_cpf text,
    checkin_status text not null default 'inscrito',
    registered_at timestamptz not null default now(),
    confirmed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint event_quorum_registry_event_profile_uq unique (event_id, profile_id)
  );

  -- DML tenant-scoped (require_session_tenant_id dentro de backfill)
  perform public.backfill_event_quorum_registry();

  return true;
exception
  when undefined_table then
    raise exception
      'Dependências ausentes. Execute events-requer-quorum.sql e checkins-totem-flow.sql antes.';
end;
$$;

grant execute on function public.ensure_event_quorum_registry() to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 12. sync_checkin_for_registration
-- Fonte: checkins-totem-flow.sql
-- ---------------------------------------------------------------------------
create or replace function public.sync_checkin_for_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_family_id text,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_totem_ativo boolean;
  v_requer_quorum boolean;
  v_check_in_automatico text;
  v_status text;
begin
  if p_registration_id is null or p_profile_id is null then
    return;
  end if;

  select coalesce(e.totem_ativo, false), coalesce(e.requer_quorum, false)
    into v_totem_ativo, v_requer_quorum
  from public.events e
  where e.tenant_id = v_tenant
    and e.id = p_event_id;

  if not found then
    return;
  end if;

  if coalesce(v_totem_ativo, false) or coalesce(v_requer_quorum, false) then
    v_status := 'pre_checkin';
  else
    select ap.value
      into v_check_in_automatico
    from public.app_parameters ap
    where ap.tenant_id = v_tenant
      and lower(ap.parameter) = 'check_in_automatico'
    limit 1;

    -- check_In_Automatico = nao → fluxo manual com QR; sem linha em checkins aqui.
    if lower(trim(coalesce(v_check_in_automatico, ''))) = 'nao' then
      perform public.maybe_sync_quorum_registry_for_registration(
        p_event_id,
        p_registration_id,
        p_profile_id
      );
      return;
    end if;

    v_status := 'confirmado';
  end if;

  insert into public.checkins (
    event_id,
    event_registration_id,
    family_id,
    profile_id,
    status,
    timestamp_confirmacao,
    tenant_id
  )
  values (
    p_event_id,
    p_registration_id,
    upper(trim(coalesce(nullif(trim(p_family_id), ''), '—'))),
    p_profile_id,
    v_status,
    case when v_status = 'confirmado' then now() else null end,
    v_tenant
  )
  on conflict (event_registration_id) do update
  set
    family_id = excluded.family_id,
    profile_id = excluded.profile_id,
    status = case
      when public.checkins.status = 'confirmado' then 'confirmado'
      else excluded.status
    end,
    timestamp_confirmacao = case
      when excluded.status = 'confirmado' then coalesce(public.checkins.timestamp_confirmacao, now())
      else public.checkins.timestamp_confirmacao
    end,
    tenant_id = coalesce(public.checkins.tenant_id, excluded.tenant_id);

  perform public.maybe_sync_quorum_registry_for_registration(
    p_event_id,
    p_registration_id,
    p_profile_id
  );
end;
$$;

grant execute on function public.sync_checkin_for_registration(uuid, uuid, text, uuid) to anon;
grant execute on function public.sync_checkin_for_registration(uuid, uuid, text, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 13. sync_quorum_registry_for_registration
-- Fonte: events-quorum-registry.sql
-- ---------------------------------------------------------------------------
create or replace function public.sync_quorum_registry_for_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_requer_quorum boolean;
  v_event public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_checkin public.checkins%rowtype;
  v_status text;
  v_registered_at timestamptz;
begin
  if p_event_id is null or p_profile_id is null then
    return;
  end if;

  select coalesce(e.requer_quorum, false)
    into v_requer_quorum
  from public.events e
  where e.tenant_id = v_tenant
    and e.id = p_event_id;

  if not coalesce(v_requer_quorum, false) then
    return;
  end if;

  select *
    into v_event
  from public.events e
  where e.tenant_id = v_tenant
    and e.id = p_event_id;

  if not found then
    return;
  end if;

  select *
    into v_profile
  from public.profiles p
  where p.id = p_profile_id
    and (p.tenant_id = v_tenant or p.tenant_id is null);

  if not found then
    return;
  end if;

  if p_registration_id is not null then
    select *
      into v_checkin
    from public.checkins c
    where c.tenant_id = v_tenant
      and c.event_registration_id = p_registration_id
    limit 1;
  end if;

  if v_checkin.id is not null then
    v_status := coalesce(nullif(trim(v_checkin.status), ''), 'pre_checkin');
    v_registered_at := coalesce(v_checkin.created_at, now());
  else
    v_status := 'inscrito';
    v_registered_at := now();
  end if;

  insert into public.event_quorum_registry (
    event_id,
    event_registration_id,
    profile_id,
    checkin_id,
    event_name,
    event_date,
    event_local,
    max_capacity,
    participant_name,
    participant_phone,
    participant_email,
    participant_cpf,
    checkin_status,
    registered_at,
    confirmed_at,
    updated_at,
    tenant_id
  )
  values (
    p_event_id,
    p_registration_id,
    p_profile_id,
    v_checkin.id,
    coalesce(nullif(trim(v_event.name), ''), 'Evento'),
    v_event.event_date::date,
    nullif(trim(coalesce(v_event.event_local, '')), ''),
    v_event.max_capacity,
    nullif(trim(coalesce(v_profile.full_name, '')), ''),
    nullif(trim(coalesce(v_profile.phone, '')), ''),
    nullif(trim(coalesce(v_profile.email, '')), ''),
    nullif(trim(coalesce(v_profile.cpf, '')), ''),
    v_status,
    v_registered_at,
    v_checkin.timestamp_confirmacao,
    now(),
    v_tenant
  )
  on conflict (event_id, profile_id) do update
  set
    event_registration_id = coalesce(excluded.event_registration_id, public.event_quorum_registry.event_registration_id),
    checkin_id = coalesce(excluded.checkin_id, public.event_quorum_registry.checkin_id),
    event_name = excluded.event_name,
    event_date = excluded.event_date,
    event_local = excluded.event_local,
    max_capacity = excluded.max_capacity,
    participant_name = excluded.participant_name,
    participant_phone = excluded.participant_phone,
    participant_email = excluded.participant_email,
    participant_cpf = excluded.participant_cpf,
    checkin_status = excluded.checkin_status,
    confirmed_at = excluded.confirmed_at,
    updated_at = now(),
    tenant_id = coalesce(public.event_quorum_registry.tenant_id, excluded.tenant_id),
    registered_at = case
      when public.event_quorum_registry.checkin_id is null
        and excluded.checkin_id is not null
        then excluded.registered_at
      else public.event_quorum_registry.registered_at
    end;
end;
$$;

grant execute on function public.sync_quorum_registry_for_registration(uuid, uuid, uuid) to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 14. session_can_purge_geofence_event_checkins
-- Fonte: geo-checkin-purge-on-event-update.sql
-- ACL-only (sem listagem de linhas) — tenant opcional; sem alteração de DML.
-- ---------------------------------------------------------------------------
-- NOTICE: session_can_purge_geofence_event_checkins só checa ACL/trigger/service_role;
-- não toca tabelas de dados — patch de tenant desnecessário.
do $$ begin
  raise notice 'wave4b: skipped session_can_purge_geofence_event_checkins (ACL-only, no data DML)';
end $$;


-- ---------------------------------------------------------------------------
-- 15. get_scale_cycle_context
-- Fonte: escalas-apply-cycle-batch.sql
-- ---------------------------------------------------------------------------
create or replace function public.get_scale_cycle_context(p_tipo_escala_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_max_date date;
  v_scheduled_dates date[];
  v_occupancy jsonb := '{}'::jsonb;
  v_vagas integer := 1;
  v_modo_ciclo text := 'individual';
begin
  if p_tipo_escala_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Tipo de escala não informado.'
    );
  end if;

  select
    coalesce(te.vagas_por_servico, 1),
    coalesce(te.modo_ciclo, 'individual')
  into v_vagas, v_modo_ciclo
  from public.tipos_escala te
  where te.tenant_id = v_tenant
    and te.id = p_tipo_escala_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Tipo de escala não encontrado.'
    );
  end if;

  select max(el.data_servico)
  into v_max_date
  from public.escalas_log el
  where el.tenant_id = v_tenant
    and el.tipo_escala_id = p_tipo_escala_id;

  select coalesce(
    array_agg(distinct el.data_servico order by el.data_servico),
    array[]::date[]
  )
  into v_scheduled_dates
  from public.escalas_log el
  where el.tenant_id = v_tenant
    and el.tipo_escala_id = p_tipo_escala_id;

  select coalesce(
    jsonb_object_agg(el.data_servico::text, el.cnt),
    '{}'::jsonb
  )
  into v_occupancy
  from (
    select el.data_servico, count(*)::integer as cnt
    from public.escalas_log el
    where el.tenant_id = v_tenant
      and el.tipo_escala_id = p_tipo_escala_id
    group by el.data_servico
  ) el;

  return jsonb_build_object(
    'success', true,
    'max_service_date', v_max_date,
    'scheduled_dates', to_jsonb(coalesce(v_scheduled_dates, array[]::date[])),
    'occupancy_by_date', v_occupancy,
    'vagas_por_servico', v_vagas,
    'modo_ciclo', v_modo_ciclo
  );
end;
$$;

grant execute on function public.get_scale_cycle_context(uuid) to anon;
grant execute on function public.get_scale_cycle_context(uuid) to authenticated;


notify pgrst, 'reload schema';

commit;
