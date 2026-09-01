select jsonb_build_object(
  'family_has_uses_geo_confirmed', (
    select pg_get_functiondef(p.oid) ilike '%geo_confirmed_at%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'family_has_geo_checkin_at_event'
    limit 1
  ),
  'sync_checkin_uses_geofence_flag', (
    select pg_get_functiondef(p.oid) ilike '%geofence_ativo%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sync_checkin_for_registration'
    limit 1
  ),
  'hotel_costa_norte_coords', (
    select jsonb_build_object('latitude', fl.latitude, 'longitude', fl.longitude, 'event_local', e.event_local)
    from public.events e
    join public.event_favorite_locations fl
      on public.normalize_location_key(fl.name) = public.normalize_location_key(e.event_local)
     and fl.tenant_id = e.tenant_id
    where e.id = '637072db-851b-47e4-86e3-272b17eec180'
    limit 1
  ),
  'salao_sem_coords', (
    select not exists (
      select 1
      from public.events e
      join public.event_favorite_locations fl
        on public.normalize_location_key(fl.name) = public.normalize_location_key(e.event_local)
       and fl.tenant_id = e.tenant_id
       and fl.latitude is not null
      where e.id = 'b082ae17-a099-4804-a273-bf4b03121f21'
    )
  ),
  'haversine_hotel_self_m', public.haversine_distance_meters(-23.5992715, -45.342999, -23.5992715, -45.342999),
  'haversine_25m_approx', public.haversine_distance_meters(-23.5992715, -45.342999, -23.5990468, -45.342999),
  'radius_default', public.geo_checkin_radius_meters(),
  'hours_before', public.geo_checkin_hours_before()
) as geofence_post_patch;
