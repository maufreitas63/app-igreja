-- Distância do geofence por local favorito (e, portanto, por evento da mesma instância).
-- O check-in usa o raio do local cujo nome casa com events.event_local e o mesmo tenant.
-- Aplica: npx supabase db query --linked -f scripts/event-favorite-geofence-radius.sql

begin;

alter table public.event_favorite_locations
  add column if not exists geofence_radius_meters integer;

update public.event_favorite_locations
   set geofence_radius_meters = 150
 where geofence_radius_meters is null
    or geofence_radius_meters <= 0;

alter table public.event_favorite_locations
  alter column geofence_radius_meters set default 150;

alter table public.event_favorite_locations
  alter column geofence_radius_meters set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'event_favorite_locations_geofence_radius_check'
  ) then
    alter table public.event_favorite_locations
      add constraint event_favorite_locations_geofence_radius_check
      check (geofence_radius_meters > 0);
  end if;
end $$;

comment on column public.event_favorite_locations.geofence_radius_meters is
  'Raio do check-in por proximidade, em metros, para eventos desta instância vinculados a este local.';

create or replace function public.resolve_event_geofence_radius_meters(p_event_id uuid)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select fl.geofence_radius_meters::double precision
        from public.events e
        join public.event_favorite_locations fl
          on public.normalize_location_key(fl.name) = public.normalize_location_key(e.event_local)
         and fl.tenant_id = e.tenant_id
         and coalesce(fl.is_active, true) is true
       where e.tenant_id = public.require_session_tenant_id()
         and e.id = p_event_id
         and fl.latitude is not null
         and fl.longitude is not null
         and fl.geofence_radius_meters > 0
       order by fl.sort_order asc, fl.name asc
       limit 1
    ),
    150::double precision
  );
$$;

comment on function public.resolve_event_geofence_radius_meters(uuid) is
  'Raio do geofence do evento, lido do local favorito da mesma instância. Padrão 150 m.';

grant execute on function public.resolve_event_geofence_radius_meters(uuid) to anon, authenticated;

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
    raise exception 'Local do evento sem coordenadas para check-in por proximidade.';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Coordenadas do dispositivo são obrigatórias para check-in no local.';
  end if;

  v_radius := public.resolve_event_geofence_radius_meters(p_event_id);
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

create or replace function public.favorite_location_has_geofence_relevant_changes(
  p_old public.event_favorite_locations,
  p_new public.event_favorite_locations
)
returns boolean
language sql
immutable
as $$
  select
    p_old.name is distinct from p_new.name
    or p_old.latitude is distinct from p_new.latitude
    or p_old.longitude is distinct from p_new.longitude
    or p_old.geofence_radius_meters is distinct from p_new.geofence_radius_meters
    or coalesce(p_old.is_active, true) is distinct from coalesce(p_new.is_active, true);
$$;

notify pgrst, 'reload schema';

commit;
