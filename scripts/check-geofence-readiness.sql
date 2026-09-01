-- Diagnóstico único (json) do check-in por geofence. Somente leitura.

select jsonb_build_object(
  'functions', (
    select jsonb_agg(jsonb_build_object('name', p.proname, 'args', pg_get_function_identity_arguments(p.oid)) order by p.proname, 2)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'confirm_geo_family_checkin_atomic',
        'sync_family_event_registrations_atomic',
        'assert_geofence_for_event',
        'assert_event_geofence_checkin_enabled',
        'assert_geofence_checkin_time_window',
        'resolve_event_geofence_coordinates',
        'family_has_geo_checkin_at_event',
        'geo_checkin_radius_meters',
        'geo_checkin_hours_before',
        'haversine_distance_meters',
        'sync_checkin_for_registration',
        'ensure_events_geofence_ativo_column',
        'normalize_location_key'
      )
  ),
  'checkins_geo_columns', (
    select coalesce(jsonb_agg(column_name order by column_name), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checkins'
      and column_name in ('geo_latitude', 'geo_longitude', 'geo_confirmed_at')
  ),
  'events_geofence_ativo_column', (
    select jsonb_build_object(
      'exists', true,
      'data_type', c.data_type,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    )
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'events'
      and c.column_name = 'geofence_ativo'
  ),
  'favorite_locations', (
    select jsonb_build_object(
      'total', count(*)::int,
      'with_coords', count(*) filter (
        where coalesce(is_active, true) and latitude is not null and longitude is not null
      )::int
    )
    from public.event_favorite_locations
  ),
  'app_parameters', (
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'parameter', parameter,
        'value', value,
        'tenant_id', tenant_id
      ) order by lower(parameter), tenant_id),
      '[]'::jsonb
    )
    from public.app_parameters
    where lower(parameter) in (
      'check_in_geofence_tempo',
      'check_in_geofence_raio_metros',
      'check_in_automatico',
      'qrcode_ativo'
    )
  ),
  'geofence_events', (
    select jsonb_build_object(
      'total', count(*)::int,
      'upcoming_or_today', count(*) filter (where event_date >= now() - interval '1 day')::int,
      'upcoming_with_local', count(*) filter (
        where event_date >= now() - interval '1 day'
          and nullif(trim(coalesce(event_local, '')), '') is not null
      )::int
    )
    from public.events
    where coalesce(geofence_ativo, false) = true
  ),
  'upcoming_geofence_events', (
    select coalesce(jsonb_agg(row_to_json(t) order by t.event_date), '[]'::jsonb)
    from (
      select
        e.id,
        e.name,
        e.event_date,
        e.event_local,
        e.geofence_ativo,
        (
          select loc.latitude
          from public.event_favorite_locations loc
          where coalesce(loc.is_active, true)
            and loc.latitude is not null
            and loc.longitude is not null
            and lower(trim(loc.name)) = lower(trim(e.event_local))
          order by loc.sort_order, loc.name
          limit 1
        ) as latitude,
        (
          select loc.longitude
          from public.event_favorite_locations loc
          where coalesce(loc.is_active, true)
            and loc.latitude is not null
            and loc.longitude is not null
            and lower(trim(loc.name)) = lower(trim(e.event_local))
          order by loc.sort_order, loc.name
          limit 1
        ) as longitude
      from public.events e
      where coalesce(e.geofence_ativo, false) = true
        and e.event_date >= now() - interval '1 day'
      order by e.event_date
      limit 20
    ) t
  )
) as geofence_readiness;
