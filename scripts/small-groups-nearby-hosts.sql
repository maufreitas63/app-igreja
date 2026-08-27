-- Anfitriões disponíveis para quem ainda não está em um grupo.
-- Distância em metros (CEP do membro da sessão × CEP do anfitrião), menor → maior.

create or replace function public.list_nearby_small_group_hosts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_lat double precision;
  v_lng double precision;
begin
  if v_me is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Sessão inválida.',
      'has_member_location', false,
      'hosts', '[]'::jsonb
    );
  end if;

  select geo.latitude, geo.longitude
    into v_lat, v_lng
    from public.profiles p
    left join public.cep_geolocations geo
      on length(regexp_replace(coalesce(p.cep, ''), '\D', '', 'g')) = 8
     and geo.cep_digits = regexp_replace(coalesce(p.cep, ''), '\D', '', 'g')
   where p.id = v_me;

  return jsonb_build_object(
    'success', true,
    'has_member_location', (v_lat is not null and v_lng is not null),
    'hosts',
    coalesce(
      (
        select jsonb_agg(q.item order by q.sort_distance nulls last, q.host_name)
        from (
          select
            jsonb_build_object(
              'group_id', g.id,
              'group_name', g.name,
              'host_profile_id', h.id,
              'host_name', h.full_name,
              'neighborhood', coalesce(
                nullif(trim(h.address_neighborhood), ''),
                nullif(trim(hgeo.bairro), ''),
                'Bairro não informado'
              ),
              'distance_meters',
                case
                  when v_lat is not null
                   and v_lng is not null
                   and hgeo.latitude is not null
                   and hgeo.longitude is not null
                  then round(
                    public.haversine_distance_meters(
                      v_lat, v_lng, hgeo.latitude, hgeo.longitude
                    )
                  )::int
                  else null
                end
            ) as item,
            case
              when v_lat is not null
               and v_lng is not null
               and hgeo.latitude is not null
               and hgeo.longitude is not null
              then public.haversine_distance_meters(
                v_lat, v_lng, hgeo.latitude, hgeo.longitude
              )
              else null
            end as sort_distance,
            coalesce(h.full_name, '') as host_name
          from public.small_groups g
          join public.profiles h
            on h.id = g.host_profile_id
          left join public.cep_geolocations hgeo
            on length(regexp_replace(coalesce(h.cep, ''), '\D', '', 'g')) = 8
           and hgeo.cep_digits = regexp_replace(coalesce(h.cep, ''), '\D', '', 'g')
         where g.tenant_id = v_tenant
           and g.is_active
           and g.host_profile_id is not null
           and h.membership_out is null
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_nearby_small_group_hosts() to anon, authenticated;
