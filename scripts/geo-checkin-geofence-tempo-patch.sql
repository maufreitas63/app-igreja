-- Patch: janela de tempo do check-in geo via app_parameters.check_in_geofence_tempo (horas antes do evento).
-- Execute se geo-checkin-automatic.sql já foi aplicado sem estas funções.

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

grant execute on function public.geo_checkin_hours_before() to anon, authenticated;

notify pgrst, 'reload schema';
