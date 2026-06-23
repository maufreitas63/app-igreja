-- Patch: geofence passa a usar event_favorite_locations (não events.latitude/longitude).
-- Execute se já aplicou uma versão anterior de geo-checkin-automatic.sql com colunas em events.
-- Seguro reexecutar: apenas recria funções.

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

grant execute on function public.resolve_event_geofence_coordinates(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
