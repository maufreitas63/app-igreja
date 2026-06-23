-- Check-in automático por geolocalização (geofence 30 m, RPCs atômicas, RLS).
-- Coordenadas do evento: resolvidas via events.event_local → event_favorite_locations.name
-- Pré-requisitos: event-favorite-locations.sql, register-member-atomic.sql, checkins-totem-flow.sql,
--   access-control-table-rls.sql
-- Execute no SQL Editor do Supabase.

-- ---------------------------------------------------------------------------
-- 1. Auditoria geo em checkins (lat/lng do local vêm de event_favorite_locations)
-- ---------------------------------------------------------------------------

alter table public.checkins
  add column if not exists geo_latitude double precision null,
  add column if not exists geo_longitude double precision null,
  add column if not exists geo_confirmed_at timestamptz null;

-- ---------------------------------------------------------------------------
-- 2. Helpers: distância, coordenadas do evento e autorização familiar
-- ---------------------------------------------------------------------------

create or replace function public.haversine_distance_meters(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select
    6371000.0 * 2.0 * asin(
      sqrt(
        power(sin(radians(p_lat2 - p_lat1) / 2.0), 2.0)
        + cos(radians(p_lat1))
          * cos(radians(p_lat2))
          * power(sin(radians(p_lon2 - p_lon1) / 2.0), 2.0)
      )
    );
$$;

create or replace function public.geo_checkin_radius_meters()
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when trim(ap.value) ~ '^\d+(\.\d+)?$' then trim(ap.value)::double precision
        else null
      end
      from public.app_parameters ap
      where lower(ap.parameter) = 'check_in_geofence_raio_metros'
      limit 1
    ),
    30.0
  );
$$;

create or replace function public.geo_checkin_hours_before()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
        else null
      end
      from public.app_parameters ap
      where lower(ap.parameter) = 'check_in_geofence_tempo'
      limit 1
    ),
    0
  );
$$;

create or replace function public.assert_geofence_checkin_time_window(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_date timestamptz;
  v_hours_before integer;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_event_day date;
begin
  select e.event_date
    into v_event_date
  from public.events e
  where e.id = p_event_id;

  if not found or v_event_date is null then
    return;
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

-- Resolve lat/lng do evento pelo nome do local (events.event_local = event_favorite_locations.name).
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
    on lower(trim(fl.name)) = lower(trim(coalesce(e.event_local, '')))
   and coalesce(fl.is_active, true) is true
  where e.id = p_event_id
    and nullif(trim(coalesce(e.event_local, '')), '') is not null
    and fl.latitude is not null
    and fl.longitude is not null
  order by fl.sort_order asc, fl.name asc
  limit 1;
$$;

comment on function public.resolve_event_geofence_coordinates(uuid) is
  'Geofence: coordenadas do evento a partir do local favorito vinculado por event_local.';

create or replace function public.assert_session_can_manage_family(p_family_group_id text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session_profile_id uuid;
  v_session_family text;
  v_normalized_family text;
begin
  v_session_profile_id := public.current_session_profile_id();

  if v_session_profile_id is null then
    raise exception 'Sessão não identificada.';
  end if;

  v_normalized_family := nullif(trim(coalesce(p_family_group_id, '')), '');

  if v_normalized_family is null then
    raise exception 'Família não informada.';
  end if;

  select nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')
    into v_session_family
  from public.profiles p
  where p.id = v_session_profile_id;

  if v_session_family is null or v_session_family <> v_normalized_family then
    raise exception 'Você só pode gerenciar o pré-cadastro da sua família.';
  end if;
end;
$$;

create or replace function public.assert_geofence_for_event(
  p_event_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_skip_geofence boolean
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_lat double precision;
  v_event_lng double precision;
  v_distance double precision;
  v_radius double precision;
begin
  if coalesce(p_skip_geofence, false) then
    return;
  end if;

  perform public.assert_geofence_checkin_time_window(p_event_id);

  select r.latitude, r.longitude
    into v_event_lat, v_event_lng
  from public.resolve_event_geofence_coordinates(p_event_id) r
  limit 1;

  if v_event_lat is null or v_event_lng is null then
    return;
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Coordenadas do dispositivo são obrigatórias para check-in no local.';
  end if;

  v_radius := public.geo_checkin_radius_meters();
  v_distance := public.haversine_distance_meters(
    p_latitude,
    p_longitude,
    v_event_lat,
    v_event_lng
  );

  if v_distance > v_radius then
    raise exception 'Você precisa estar no local do evento (até %s m).', v_radius::text;
  end if;
end;
$$;

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
    where er.event_id = p_event_id
      and er.family_id = trim(p_family_group_id)
      and c.status in ('pre_checkin', 'confirmado')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC atômica: sincronizar audiência da família (upsert + remoções)
-- ---------------------------------------------------------------------------

create or replace function public.sync_family_event_registrations_atomic(
  p_event_id uuid,
  p_family_group_id text,
  p_member_ids uuid[],
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_skip_geofence boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_result jsonb;
  v_names text[] := '{}';
  v_name text;
  v_target_profile_ids uuid[] := '{}';
  v_profile_id uuid;
  v_member members%rowtype;
  v_has_existing_checkin boolean;
begin
  perform public.assert_session_can_manage_family(p_family_group_id);

  v_has_existing_checkin := public.family_has_geo_checkin_at_event(p_event_id, p_family_group_id);

  perform public.assert_geofence_for_event(
    p_event_id,
    p_latitude,
    p_longitude,
    coalesce(p_skip_geofence, false) or v_has_existing_checkin
  );

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
  loop
    select m.*
      into v_member
    from public.members m
    where m.id = v_member_id
      and m.accepted is true;

    if not found then
      raise exception 'Membro % não encontrado ou não reconhecido.', v_member_id::text;
    end if;

    if v_member.family_id is not null
       and trim(v_member.family_id) <> trim(p_family_group_id) then
      raise exception 'Membro % não pertence à família informada.', v_member_id::text;
    end if;

    v_profile_id := public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name);

    if v_profile_id is null then
      raise exception 'Perfil vinculado ao membro % não foi encontrado.', v_member_id::text;
    end if;

    v_target_profile_ids := array_append(v_target_profile_ids, v_profile_id);
  end loop;

  delete from public.event_registrations er
  where er.event_id = p_event_id
    and er.family_id = trim(p_family_group_id)
    and (
      cardinality(v_target_profile_ids) = 0
      or er.profile_id <> all (v_target_profile_ids)
    );

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
  loop
    v_result := public.register_member_atomic(p_event_id, v_member_id, p_family_group_id);

    if coalesce((v_result ->> 'success')::boolean, false) is not true then
      raise exception '%', coalesce(v_result ->> 'message', 'Falha ao registrar participante.');
    end if;

    select m.full_name
      into v_name
    from public.members m
    where m.id = v_member_id;

    if v_name is not null then
      v_names := array_append(v_names, trim(v_name));
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Audiência da família atualizada com sucesso.',
    'participant_names', to_jsonb(v_names)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC atômica: confirmar check-in geo da família
-- ---------------------------------------------------------------------------

create or replace function public.confirm_geo_family_checkin_atomic(
  p_event_id uuid,
  p_family_group_id text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_skip_geofence boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg record;
  v_names text[] := '{}';
  v_has_existing_checkin boolean;
  v_updated_count integer := 0;
begin
  perform public.assert_session_can_manage_family(p_family_group_id);

  v_has_existing_checkin := public.family_has_geo_checkin_at_event(p_event_id, p_family_group_id);

  perform public.assert_geofence_for_event(
    p_event_id,
    p_latitude,
    p_longitude,
    coalesce(p_skip_geofence, false) or v_has_existing_checkin
  );

  if not exists (
    select 1
    from public.event_registrations er
    where er.event_id = p_event_id
      and er.family_id = trim(p_family_group_id)
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum pré-cadastro encontrado para esta família neste evento.',
      'requires_precheckin', true
    );
  end if;

  for v_reg in
    select er.id as registration_id, er.profile_id, er.full_name
    from public.event_registrations er
    where er.event_id = p_event_id
      and er.family_id = trim(p_family_group_id)
    order by er.created_at
  loop
    perform public.sync_checkin_for_registration(
      p_event_id,
      v_reg.registration_id,
      trim(p_family_group_id),
      v_reg.profile_id
    );

    update public.checkins c
    set
      status = 'confirmado',
      timestamp_confirmacao = coalesce(c.timestamp_confirmacao, now()),
      geo_latitude = p_latitude,
      geo_longitude = p_longitude,
      geo_confirmed_at = now()
    where c.event_registration_id = v_reg.registration_id
      and c.event_id = p_event_id;

    get diagnostics v_updated_count = row_count;

    if v_updated_count = 0 then
      insert into public.checkins (
        event_id,
        event_registration_id,
        family_id,
        profile_id,
        status,
        timestamp_confirmacao,
        geo_latitude,
        geo_longitude,
        geo_confirmed_at
      )
      values (
        p_event_id,
        v_reg.registration_id,
        trim(p_family_group_id),
        v_reg.profile_id,
        'confirmado',
        now(),
        p_latitude,
        p_longitude,
        now()
      )
      on conflict (event_registration_id) do update
      set
        status = 'confirmado',
        timestamp_confirmacao = coalesce(checkins.timestamp_confirmacao, excluded.timestamp_confirmacao),
        geo_latitude = excluded.geo_latitude,
        geo_longitude = excluded.geo_longitude,
        geo_confirmed_at = excluded.geo_confirmed_at;
    end if;

    if v_reg.full_name is not null and trim(v_reg.full_name) <> '' then
      v_names := array_append(v_names, trim(v_reg.full_name));
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Check-in confirmado com sucesso.',
    'participant_names', to_jsonb(v_names)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS em event_registrations (família da sessão)
-- ---------------------------------------------------------------------------

alter table public.event_registrations enable row level security;

drop policy if exists event_registrations_select_family on public.event_registrations;
create policy event_registrations_select_family
  on public.event_registrations
  for select
  to anon, authenticated
  using (
    not public.acl_enforcement_enabled()
    or family_id = public.session_profile_family_id()
    or profile_id = public.current_session_profile_id()
  );

drop policy if exists event_registrations_insert_family on public.event_registrations;
create policy event_registrations_insert_family
  on public.event_registrations
  for insert
  to anon, authenticated
  with check (
    not public.acl_enforcement_enabled()
    or family_id = public.session_profile_family_id()
    or profile_id = public.current_session_profile_id()
  );

drop policy if exists event_registrations_update_family on public.event_registrations;
create policy event_registrations_update_family
  on public.event_registrations
  for update
  to anon, authenticated
  using (
    not public.acl_enforcement_enabled()
    or family_id = public.session_profile_family_id()
    or profile_id = public.current_session_profile_id()
  )
  with check (
    not public.acl_enforcement_enabled()
    or family_id = public.session_profile_family_id()
    or profile_id = public.current_session_profile_id()
  );

drop policy if exists event_registrations_delete_family on public.event_registrations;
create policy event_registrations_delete_family
  on public.event_registrations
  for delete
  to anon, authenticated
  using (
    not public.acl_enforcement_enabled()
    or family_id = public.session_profile_family_id()
    or profile_id = public.current_session_profile_id()
  );

grant execute on function public.haversine_distance_meters(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.geo_checkin_radius_meters() to anon, authenticated;
grant execute on function public.geo_checkin_hours_before() to anon, authenticated;
grant execute on function public.resolve_event_geofence_coordinates(uuid) to anon, authenticated;
grant execute on function public.family_has_geo_checkin_at_event(uuid, text) to anon, authenticated;
grant execute on function public.sync_family_event_registrations_atomic(uuid, text, uuid[], double precision, double precision, boolean) to anon, authenticated;
grant execute on function public.confirm_geo_family_checkin_atomic(uuid, text, double precision, double precision, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
