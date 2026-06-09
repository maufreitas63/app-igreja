-- Corrige geocodificação Photon: lang=pt não é suportado pela API.
-- Execute no SQL Editor e depois rode:
--   select public.backfill_cep_geolocations_from_profiles();

create or replace function public.fetch_photon_coordinates(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_status integer;
  v_content text;
  v_body jsonb;
  v_url text;
  v_lng double precision;
  v_lat double precision;
begin
  if nullif(trim(p_query), '') is null then
    return null;
  end if;

  v_url := 'https://photon.komoot.io/api/?q='
    || public.url_encode_query_component(trim(p_query))
    || '&limit=1';

  begin
    begin
      select
        r.status,
        r.content::text
      into v_status, v_content
      from extensions.http_get(v_url) as r(status, content_type, headers, content);
    exception
      when undefined_function then
        select
          r.status,
          r.content::text
        into v_status, v_content
        from http_get(v_url) as r(status, content_type, headers, content);
    end;

    if coalesce(v_status, 0) <> 200 or v_content is null then
      return null;
    end if;

    v_body := v_content::jsonb;

    if v_body ? 'lang' then
      return null;
    end if;

    v_lng := nullif(v_body #>> '{features,0,geometry,coordinates,0}', '')::double precision;
    v_lat := nullif(v_body #>> '{features,0,geometry,coordinates,1}', '')::double precision;

    if v_lat is null or v_lng is null then
      return null;
    end if;

    if public.is_unreliable_map_coord(v_lat, v_lng) then
      return null;
    end if;

    return jsonb_build_object('latitude', v_lat, 'longitude', v_lng);
  exception
    when undefined_function then
      raise notice 'Extensão http não habilitada. Use: node scripts/backfill-cep-geolocations.mjs';
      return null;
    when others then
      return null;
  end;
end;
$$;

select public.backfill_cep_geolocations_from_profiles();

notify pgrst, 'reload schema';
