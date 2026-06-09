-- Tabela de geolocalização por CEP (latitude/longitude) para o mapa de membros.
-- Popula CEPs existentes em profiles e mantém atualizada a cada novo cadastro/alteração de CEP.
--
-- Requer extensão http (Database → Extensions → http) para geocodificação server-side.
-- O app também pode gravar coordenadas via RPC upsert_cep_geolocation (Photon no cliente).
--
-- Execute no SQL Editor do Supabase.

-- ---------------------------------------------------------------------------
-- Pré-requisitos: normalização de CEP e cache de endereço (ViaCEP)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_profile_cep_digits(p_cep text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g')) = 8
      then regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g')
    else null
  end
$$;

create or replace function public.format_profile_cep_display(p_cep_digits text)
returns text
language sql
immutable
as $$
  select case
    when p_cep_digits is not null and length(p_cep_digits) = 8
      then substring(p_cep_digits, 1, 5) || '-' || substring(p_cep_digits, 6, 3)
    else null
  end
$$;

create table if not exists public.cep_address_cache (
  cep_digits text primary key,
  logradouro text,
  bairro text,
  localidade text,
  uf text,
  complemento text,
  source text not null default 'viacep',
  fetched_at timestamptz not null default now()
);

comment on table public.cep_address_cache is
  'Cache de consultas de CEP (ViaCEP ou cópia entre perfis).';

create or replace function public.fetch_viacep_address(p_cep_digits text)
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
begin
  if p_cep_digits is null or length(p_cep_digits) <> 8 then
    return null;
  end if;

  v_url := 'https://viacep.com.br/ws/' || p_cep_digits || '/json/';

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

    if v_body ? 'erro' then
      return null;
    end if;

    return v_body;
  exception
    when undefined_function then
      raise notice 'Extensão http não habilitada. Habilite em Database → Extensions ou use o app.';
      return null;
    when others then
      return null;
  end;
end;
$$;

drop function if exists public.ensure_cep_address_cache(text);
drop function if exists public.ensure_cep_address_cache(text, boolean);

create or replace function public.ensure_cep_address_cache(
  p_cep_digits text,
  p_force_refresh boolean default false
)
returns public.cep_address_cache
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached public.cep_address_cache;
  v_body jsonb;
begin
  if p_cep_digits is null or length(p_cep_digits) <> 8 then
    return null;
  end if;

  if p_force_refresh then
    delete from public.cep_address_cache c
     where c.cep_digits = p_cep_digits;
  end if;

  select *
    into v_cached
    from public.cep_address_cache c
   where c.cep_digits = p_cep_digits;

  if found then
    return v_cached;
  end if;

  v_body := public.fetch_viacep_address(p_cep_digits);

  if v_body is not null then
    insert into public.cep_address_cache (
      cep_digits,
      logradouro,
      bairro,
      localidade,
      uf,
      complemento,
      source
    )
    values (
      p_cep_digits,
      nullif(trim(v_body ->> 'logradouro'), ''),
      nullif(trim(v_body ->> 'bairro'), ''),
      nullif(trim(v_body ->> 'localidade'), ''),
      nullif(trim(v_body ->> 'uf'), ''),
      nullif(trim(v_body ->> 'complemento'), ''),
      'viacep'
    )
    on conflict (cep_digits) do update
      set logradouro = excluded.logradouro,
          bairro = excluded.bairro,
          localidade = excluded.localidade,
          uf = excluded.uf,
          complemento = excluded.complemento,
          fetched_at = now()
    returning * into v_cached;

    return v_cached;
  end if;

  insert into public.cep_address_cache (
    cep_digits,
    logradouro,
    bairro,
    localidade,
    uf,
    complemento,
    source
  )
  select
    p_cep_digits,
    nullif(trim(p.address_street), ''),
    nullif(trim(p.address_neighborhood), ''),
    nullif(trim(p.address_city), ''),
    nullif(trim(p.address_state), ''),
    nullif(trim(p.address_complement), ''),
    'profile_peer'
  from public.profiles p
  where public.normalize_profile_cep_digits(p.cep) = p_cep_digits
    and nullif(trim(p.address_city), '') is not null
    and nullif(trim(p.address_state), '') is not null
  order by p.updated_at desc nulls last
  limit 1
  on conflict (cep_digits) do nothing
  returning * into v_cached;

  if found then
    return v_cached;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table if not exists public.cep_geolocations (
  cep_digits text primary key,
  cep_formatted text not null,
  latitude double precision not null,
  longitude double precision not null,
  logradouro text,
  bairro text,
  localidade text,
  uf text,
  geocode_source text not null default 'photon',
  geocoded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cep_geolocations_digits_len check (length(cep_digits) = 8),
  constraint cep_geolocations_lat_range check (latitude between -90 and 90),
  constraint cep_geolocations_lng_range check (longitude between -180 and 180)
);

comment on table public.cep_geolocations is
  'Coordenadas geográficas por CEP. Fonte dos pins no mapa de geolocalização.';

create index if not exists idx_cep_geolocations_updated_at
  on public.cep_geolocations (updated_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_unreliable_map_coord(
  p_latitude double precision,
  p_longitude double precision
)
returns boolean
language sql
immutable
as $$
  select
    (abs(p_latitude - (-23.6206)) < 0.0003 and abs(p_longitude - (-45.4131)) < 0.0003)
    or (abs(p_latitude - (-23.62028)) < 0.0003 and abs(p_longitude - (-45.41306)) < 0.0003)
    or (abs(p_latitude - (-23.6814497)) < 0.0003 and abs(p_longitude - (-45.4345116)) < 0.0003);
$$;

create or replace function public.url_encode_query_component(p_value text)
returns text
language sql
immutable
as $$
  select replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(coalesce(p_value, ''), '%', '%25'),
                    ' ', '%20'
                  ),
                  ',', '%2C'
                ),
                '/', '%2F'
              ),
              '?', '%3F'
            ),
            '&', '%26'
          ),
          '#', '%23'
        ),
        '+', '%2B'
      ),
      '=', '%3D'
    ),
    ';', '%3B'
  );
$$;

-- ---------------------------------------------------------------------------
-- Photon (requer extensão http)
-- ---------------------------------------------------------------------------

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
      raise notice 'Extensão http não habilitada. Use RPC upsert_cep_geolocation pelo app.';
      return null;
    when others then
      return null;
  end;
end;
$$;

create or replace function public.resolve_coordinates_for_cep_address(
  p_logradouro text,
  p_bairro text,
  p_localidade text,
  p_uf text,
  p_cep_digits text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text;
  v_queries text[] := array[]::text[];
  v_result jsonb;
  v_street_line text;
begin
  v_street_line := nullif(trim(coalesce(p_logradouro, '')), '');

  v_queries := array_append(
    v_queries,
    trim(both ', ' from concat_ws(', ', v_street_line, nullif(trim(p_bairro), ''), nullif(trim(p_localidade), ''), nullif(trim(p_uf), '')))
  );

  v_queries := array_append(
    v_queries,
    trim(both ', ' from concat_ws(', ', nullif(trim(p_bairro), ''), nullif(trim(p_localidade), ''), nullif(trim(p_uf), '')))
  );

  v_queries := array_append(
    v_queries,
    trim(both ', ' from concat_ws(', ', v_street_line, nullif(trim(p_localidade), ''), nullif(trim(p_uf), '')))
  );

  if p_cep_digits is not null and length(p_cep_digits) = 8 then
    v_queries := array_append(
      v_queries,
      public.format_profile_cep_display(p_cep_digits) || ', ' || coalesce(nullif(trim(p_localidade), ''), 'Brasil') || ' - ' || coalesce(nullif(trim(p_uf), ''), '')
    );
  end if;

  foreach v_query in array v_queries
  loop
    if nullif(trim(v_query), '') is null then
      continue;
    end if;

    v_result := public.fetch_photon_coordinates(v_query);

    if v_result is not null then
      return v_result;
    end if;
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Upsert / ensure
-- ---------------------------------------------------------------------------

create or replace function public.upsert_cep_geolocation(
  p_cep text,
  p_latitude double precision,
  p_longitude double precision,
  p_logradouro text default null,
  p_bairro text default null,
  p_localidade text default null,
  p_uf text default null,
  p_source text default 'app'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_row public.cep_geolocations%rowtype;
begin
  v_digits := public.normalize_profile_cep_digits(p_cep);

  if v_digits is null then
    raise exception 'CEP inválido. Informe 8 dígitos (ex.: 11677-042).';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Latitude e longitude são obrigatórias.';
  end if;

  if public.is_unreliable_map_coord(p_latitude, p_longitude) then
    raise exception 'Coordenadas genéricas não são aceitas para o mapa.';
  end if;

  insert into public.cep_geolocations (
    cep_digits,
    cep_formatted,
    latitude,
    longitude,
    logradouro,
    bairro,
    localidade,
    uf,
    geocode_source,
    geocoded_at,
    updated_at
  )
  values (
    v_digits,
    public.format_profile_cep_display(v_digits),
    p_latitude,
    p_longitude,
    nullif(trim(coalesce(p_logradouro, '')), ''),
    nullif(trim(coalesce(p_bairro, '')), ''),
    nullif(trim(coalesce(p_localidade, '')), ''),
    nullif(trim(coalesce(p_uf, '')), ''),
    coalesce(nullif(trim(p_source), ''), 'app'),
    now(),
    now()
  )
  on conflict (cep_digits) do update
    set cep_formatted = excluded.cep_formatted,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        logradouro = coalesce(excluded.logradouro, public.cep_geolocations.logradouro),
        bairro = coalesce(excluded.bairro, public.cep_geolocations.bairro),
        localidade = coalesce(excluded.localidade, public.cep_geolocations.localidade),
        uf = coalesce(excluded.uf, public.cep_geolocations.uf),
        geocode_source = excluded.geocode_source,
        geocoded_at = now(),
        updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.ensure_cep_geolocation(
  p_cep_digits text,
  p_force_refresh boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.cep_geolocations%rowtype;
  v_cache public.cep_address_cache;
  v_coords jsonb;
  v_row public.cep_geolocations%rowtype;
  v_logradouro text;
  v_bairro text;
  v_localidade text;
  v_uf text;
begin
  if p_cep_digits is null or length(p_cep_digits) <> 8 then
    return null;
  end if;

  if not p_force_refresh then
    select *
      into v_existing
      from public.cep_geolocations g
     where g.cep_digits = p_cep_digits;

    if found
      and not public.is_unreliable_map_coord(v_existing.latitude, v_existing.longitude) then
      return to_jsonb(v_existing);
    end if;
  end if;

  v_cache := public.ensure_cep_address_cache(p_cep_digits, false);

  if v_cache is not null then
    v_logradouro := v_cache.logradouro;
    v_bairro := v_cache.bairro;
    v_localidade := v_cache.localidade;
    v_uf := v_cache.uf;
  else
    select
      nullif(trim(p.address_street), ''),
      nullif(trim(p.address_neighborhood), ''),
      nullif(trim(p.address_city), ''),
      nullif(trim(p.address_state), '')
    into v_logradouro, v_bairro, v_localidade, v_uf
    from public.profiles p
    where public.normalize_profile_cep_digits(p.cep) = p_cep_digits
    order by p.updated_at desc nulls last
    limit 1;
  end if;

  if v_localidade is null and p_cep_digits like '116%' then
    v_localidade := 'Caraguatatuba';
    v_uf := coalesce(v_uf, 'SP');
  end if;

  v_coords := public.resolve_coordinates_for_cep_address(
    v_logradouro,
    v_bairro,
    v_localidade,
    v_uf,
    p_cep_digits
  );

  if v_coords is null then
    return null;
  end if;

  return public.upsert_cep_geolocation(
    p_cep_digits,
    (v_coords ->> 'latitude')::double precision,
    (v_coords ->> 'longitude')::double precision,
    v_logradouro,
    v_bairro,
    v_localidade,
    v_uf,
    'photon_server'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: mantém geolocalização ao cadastrar/alterar CEP em profiles
-- ---------------------------------------------------------------------------

create or replace function public.trg_profiles_upsert_cep_geolocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
begin
  if coalesce(current_setting('app.skip_cep_geolocation_trigger', true), '') = 'on' then
    return new;
  end if;

  v_digits := public.normalize_profile_cep_digits(new.cep);

  if v_digits is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and public.normalize_profile_cep_digits(old.cep) is not distinct from v_digits then
    return new;
  end if;

  perform public.ensure_cep_geolocation(v_digits, false);

  return new;
end;
$$;

drop trigger if exists trg_profiles_upsert_cep_geolocation on public.profiles;

create trigger trg_profiles_upsert_cep_geolocation
  after insert or update of cep
  on public.profiles
  for each row
  execute function public.trg_profiles_upsert_cep_geolocation();

-- ---------------------------------------------------------------------------
-- Backfill dos CEPs já existentes em profiles
-- ---------------------------------------------------------------------------

create or replace function public.backfill_cep_geolocations_from_profiles()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_total integer := 0;
  v_geocoded integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_result jsonb;
begin
  for v_digits in
    select distinct public.normalize_profile_cep_digits(p.cep) as cep_digits
      from public.profiles p
     where public.normalize_profile_cep_digits(p.cep) is not null
     order by 1
  loop
    v_total := v_total + 1;

    if exists (
      select 1
        from public.cep_geolocations g
       where g.cep_digits = v_digits
         and not public.is_unreliable_map_coord(g.latitude, g.longitude)
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_result := public.ensure_cep_geolocation(v_digits, true);

    if v_result is not null then
      v_geocoded := v_geocoded + 1;
    else
      v_failed := v_failed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'total_ceps', v_total,
    'geocoded', v_geocoded,
    'skipped_existing', v_skipped,
    'failed', v_failed
  );
end;
$$;

create or replace function public.fetch_cep_geolocations_sync_fingerprint()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::text
    || '|'
    || coalesce(max(g.updated_at)::text, 'none')
    from public.cep_geolocations g;
$$;

-- ---------------------------------------------------------------------------
-- sync_profile_address_from_cep — fonte canônica (I14)
-- Execute scripts/profiles-sync-address-from-cep-rpc.sql (não duplique o corpo aqui).
-- ---------------------------------------------------------------------------

-- Removido: definição duplicada de sync_profile_address_from_cep (usar script canônico).

/*
create or replace function public.sync_profile_address_from_cep(
  p_profile_id uuid,
  p_actor_profile_id uuid,
  p_cep text,
  p_address_street text default null,
  p_address_neighborhood text default null,
  p_address_city text default null,
  p_address_state text default null,
  p_address_number text default null,
  p_address_complement text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_formatted_cep text;
  v_updated public.profiles%rowtype;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id) then
    if p_actor_profile_id is distinct from p_profile_id then
      raise exception 'Sem permissão para alterar o cadastro de outro usuário.';
    end if;

    if not public.profile_has_access(p_actor_profile_id, 'column', 'profiles.cep', 'update') then
      raise exception 'Você não tem permissão para alterar o CEP.';
    end if;
  end if;

  v_digits := public.normalize_profile_cep_digits(p_cep);

  if v_digits is null then
    raise exception 'CEP inválido. Informe 8 dígitos (ex.: 11677-042).';
  end if;

  v_formatted_cep := public.format_profile_cep_display(v_digits);

  insert into public.cep_address_cache (
    cep_digits,
    logradouro,
    bairro,
    localidade,
    uf,
    complemento,
    source
  )
  values (
    v_digits,
    nullif(trim(coalesce(p_address_street, '')), ''),
    nullif(trim(coalesce(p_address_neighborhood, '')), ''),
    nullif(trim(coalesce(p_address_city, '')), ''),
    nullif(trim(coalesce(p_address_state, '')), ''),
    nullif(trim(coalesce(p_address_complement, '')), ''),
    'app_viacep'
  )
  on conflict (cep_digits) do update
    set logradouro = excluded.logradouro,
        bairro = excluded.bairro,
        localidade = excluded.localidade,
        uf = excluded.uf,
        complemento = excluded.complemento,
        fetched_at = now(),
        source = excluded.source;

  perform set_config('app.skip_cep_sync_trigger', 'on', true);

  update public.profiles p
  set
    cep = v_formatted_cep,
    address_street = nullif(trim(coalesce(p_address_street, '')), ''),
    address_neighborhood = nullif(trim(coalesce(p_address_neighborhood, '')), ''),
    address_city = nullif(trim(coalesce(p_address_city, '')), ''),
    address_state = nullif(trim(coalesce(p_address_state, '')), ''),
    address_number = nullif(trim(coalesce(p_address_number, '')), ''),
    address_complement = nullif(trim(coalesce(p_address_complement, '')), ''),
    updated_at = now()
  where p.id = p_profile_id
  returning p.* into v_updated;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  perform public.ensure_cep_geolocation(v_digits, true);

  return to_jsonb(v_updated);
end;
$$;
*/

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.cep_geolocations enable row level security;

drop policy if exists cep_geolocations_select_authenticated on public.cep_geolocations;

create policy cep_geolocations_select_authenticated
  on public.cep_geolocations
  for select
  to authenticated
  using (true);

drop policy if exists cep_geolocations_select_anon on public.cep_geolocations;

create policy cep_geolocations_select_anon
  on public.cep_geolocations
  for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

grant select on public.cep_geolocations to authenticated, anon;

grant execute on function public.upsert_cep_geolocation(
  text, double precision, double precision, text, text, text, text, text
) to anon, authenticated;

grant execute on function public.ensure_cep_geolocation(text, boolean) to authenticated;

grant execute on function public.backfill_cep_geolocations_from_profiles() to authenticated;

grant execute on function public.fetch_cep_geolocations_sync_fingerprint() to anon, authenticated;

drop function if exists public.fetch_cep_geolocations_by_digits(text[]);

create or replace function public.fetch_cep_geolocations_by_digits(p_cep_digits text[])
returns table (
  cep_digits text,
  cep_formatted text,
  latitude double precision,
  longitude double precision,
  logradouro text,
  bairro text,
  localidade text,
  uf text,
  geocode_source text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.cep_digits,
    g.cep_formatted,
    g.latitude,
    g.longitude,
    g.logradouro,
    g.bairro,
    g.localidade,
    g.uf,
    g.geocode_source,
    g.updated_at
  from public.cep_geolocations g
  where p_cep_digits is not null
    and cardinality(p_cep_digits) > 0
    and g.cep_digits = any(p_cep_digits);
$$;

grant execute on function public.fetch_cep_geolocations_by_digits(text[]) to anon, authenticated;

-- Backfill inicial (CEPs já cadastrados em profiles)
select public.backfill_cep_geolocations_from_profiles();

notify pgrst, 'reload schema';
