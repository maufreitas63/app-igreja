-- Preenche/atualiza endereço em public.profiles a partir do CEP.
-- Alinhado ao app (manage-profile.tsx → ViaCEP): logradouro, bairro, cidade, UF.
--
-- Estratégia:
-- 1) Cache local (cep_address_cache) + consulta ViaCEP (extensão http, se habilitada)
-- 2) Fallback: copia endereço de outro perfil com o mesmo CEP já completo
-- 3) Trigger em UPDATE/INSERT de cep
-- 4) Rotina em lote para backfill
--
-- Execute no SQL Editor do Supabase.
--
-- Table Editor: ao salvar cep, o trigger BEFORE formata como 00000-000 (9 caracteres).
-- Se a coluna for varchar(8), o último dígito é cortado (ex.: 11677-040 → 11677-04).

-- ---------------------------------------------------------------------------
-- Coluna cep: precisa caber 00000-000 (9 chars) — use text
-- Remover TODOS os triggers em cep antes do ALTER TYPE; recriados mais abaixo.
-- ---------------------------------------------------------------------------

drop trigger if exists trg_profiles_sync_address_from_cep on public.profiles;
drop trigger if exists trg_profiles_upsert_cep_geolocation on public.profiles;

do $$
begin
  if exists (
    select 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_type t on t.oid = a.atttypid
     where n.nspname = 'public'
       and c.relname = 'profiles'
       and a.attname = 'cep'
       and not a.attisdropped
       and t.typname <> 'text'
  ) then
    alter table public.profiles
      alter column cep type text using cep::text;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Normalização de CEP (8 dígitos + exibição 00000-000)
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

-- ---------------------------------------------------------------------------
-- Cache de CEP (evita consultar ViaCEP repetidamente)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- ViaCEP (requer extensão http no Supabase)
-- Dashboard → Database → Extensions → http → Enable
-- ---------------------------------------------------------------------------

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
      raise notice 'Extensão http não habilitada. Habilite em Database → Extensions ou use o app Manutenção → Cadastro de Usuário.';
      return null;
    when others then
      return null;
  end;
end;
$$;

drop function if exists public.ensure_cep_address_cache(text);

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

  -- Fallback: outro perfil com o mesmo CEP e endereço preenchido
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
-- Aplica endereço ao perfil
-- ---------------------------------------------------------------------------

drop function if exists public.apply_cep_address_to_profile(uuid, boolean);
drop function if exists public.apply_cep_address_to_profile(uuid, boolean, boolean);

create or replace function public.apply_cep_address_to_profile(
  p_profile_id uuid,
  p_force_update boolean default false,
  p_refresh_cache boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles%rowtype;
  v_digits text;
  v_cache public.cep_address_cache;
begin
  if p_profile_id is null then
    return false;
  end if;

  select *
    into v_row
    from public.profiles p
   where p.id = p_profile_id;

  if not found then
    return false;
  end if;

  v_digits := public.normalize_profile_cep_digits(v_row.cep);

  if v_digits is null then
    return false;
  end if;

  v_cache := public.ensure_cep_address_cache(v_digits, p_refresh_cache);

  if v_cache is null then
    return false;
  end if;

  perform set_config('app.skip_cep_sync_trigger', 'on', true);

  update public.profiles p
  set
    cep = public.format_profile_cep_display(v_digits),
    address_street = case
      when p_force_update then v_cache.logradouro
      when nullif(trim(p.address_street), '') is null then v_cache.logradouro
      else p.address_street
    end,
    address_neighborhood = case
      when p_force_update then v_cache.bairro
      when nullif(trim(p.address_neighborhood), '') is null then v_cache.bairro
      else p.address_neighborhood
    end,
    address_city = case
      when p_force_update then v_cache.localidade
      when nullif(trim(p.address_city), '') is null then v_cache.localidade
      else p.address_city
    end,
    address_state = case
      when p_force_update then v_cache.uf
      when nullif(trim(p.address_state), '') is null then v_cache.uf
      else p.address_state
    end,
    address_complement = case
      when p_force_update and nullif(trim(v_cache.complemento), '') is not null
        then v_cache.complemento
      when nullif(trim(p.address_complement), '') is null
        and nullif(trim(v_cache.complemento), '') is not null
        then v_cache.complemento
      else p.address_complement
    end,
    updated_at = now()
  where p.id = p_profile_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger BEFORE: preenche endereço na mesma gravação (Table Editor Supabase)
-- Sempre força atualização dos campos quando há CEP válido.
-- ---------------------------------------------------------------------------

create or replace function public.trg_profiles_sync_address_from_cep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_cache public.cep_address_cache;
begin
  v_digits := public.normalize_profile_cep_digits(new.cep);

  if v_digits is null then
    return new;
  end if;

  new.cep := public.format_profile_cep_display(v_digits);

  if coalesce(current_setting('app.skip_cep_sync_trigger', true), '') = 'on' then
    return new;
  end if;

  v_cache := public.ensure_cep_address_cache(v_digits, true);

  if v_cache is null then
    return new;
  end if;

  if nullif(trim(v_cache.logradouro), '') is not null then
    new.address_street := v_cache.logradouro;
  end if;

  if nullif(trim(v_cache.bairro), '') is not null then
    new.address_neighborhood := v_cache.bairro;
  end if;

  if nullif(trim(v_cache.localidade), '') is not null then
    new.address_city := v_cache.localidade;
  end if;

  if nullif(trim(v_cache.uf), '') is not null then
    new.address_state := v_cache.uf;
  end if;

  if nullif(trim(v_cache.complemento), '') is not null then
    new.address_complement := v_cache.complemento;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_address_from_cep on public.profiles;

create trigger trg_profiles_sync_address_from_cep
before insert or update of cep
on public.profiles
for each row
execute function public.trg_profiles_sync_address_from_cep();

-- Geolocalização por CEP (cep-geolocation-table.sql), se já instalada.
do $$
begin
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'trg_profiles_upsert_cep_geolocation'
  ) then
    execute $trg$
      create trigger trg_profiles_upsert_cep_geolocation
        after insert or update of cep
        on public.profiles
        for each row
        execute function public.trg_profiles_upsert_cep_geolocation()
    $trg$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: perfis com CEP válido e endereço incompleto
-- ---------------------------------------------------------------------------

drop function if exists public.backfill_profiles_address_from_cep(boolean, integer);
drop function if exists public.backfill_profiles_address_from_cep(boolean, boolean, integer);

create or replace function public.backfill_profiles_address_from_cep(
  p_force_update boolean default true,
  p_refresh_cache boolean default true,
  p_limit integer default 500
)
returns table (
  profile_id uuid,
  full_name text,
  cep_digits text,
  updated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_count integer := 0;
  v_limit integer;
begin
  v_limit := greatest(1, least(coalesce(p_limit, 500), 5000));

  for v_profile in
    select
      p.id,
      p.full_name,
      public.normalize_profile_cep_digits(p.cep) as cep_digits
    from public.profiles p
    where public.normalize_profile_cep_digits(p.cep) is not null
      and (
        p_force_update
        or nullif(trim(p.address_city), '') is null
        or nullif(trim(p.address_state), '') is null
        or nullif(trim(p.address_street), '') is null
        or nullif(trim(p.address_neighborhood), '') is null
      )
    order by p.updated_at desc nulls last
    limit v_limit
  loop
    v_count := v_count + 1;

    -- ViaCEP: ~3 req/s; evita bloqueio em lotes grandes
    if v_count > 1 then
      perform pg_sleep(0.35);
    end if;

    profile_id := v_profile.id;
    full_name := v_profile.full_name;
    cep_digits := v_profile.cep_digits;
    updated := public.apply_cep_address_to_profile(
      v_profile.id,
      p_force_update,
      p_refresh_cache
    );

    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Uso imediato (rode após criar as funções)
-- ---------------------------------------------------------------------------

-- 0) Diagnóstico: tipo da coluna e CEPs truncados (8 chars em vez de 9)
-- select
--   a.atttypmod,
--   pg_catalog.format_type(a.atttypid, a.atttypmod) as cep_column_type
-- from pg_attribute a
-- join pg_class c on c.oid = a.attrelid
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname = 'profiles'
--   and a.attname = 'cep'
--   and not a.attisdropped;

-- select id, full_name, cep, length(cep) as cep_len
--   from public.profiles
--  where cep is not null
--    and length(cep) = 8
--    and public.normalize_profile_cep_digits(cep) is not null;

-- 1) Prévia: perfis com CEP válido
select count(*)::bigint as perfis_com_cep_valido
  from public.profiles p
 where public.normalize_profile_cep_digits(p.cep) is not null;

-- 2) FORÇAR todos os perfis com CEP (sobrescreve endereço; repita em lotes)
-- select * from public.backfill_profiles_address_from_cep(true, true, 500);

-- 3) Um perfil específico (forçar + refresh ViaCEP)
-- select public.apply_cep_address_to_profile('<uuid-do-perfil>'::uuid, true, true);

-- 4) Re-disparar trigger em massa (útil após inserir CEP manualmente no Table Editor)
--    Toca o campo cep sem mudar o valor; o trigger BEFORE preenche o endereço.
-- update public.profiles p
--    set cep = public.format_profile_cep_display(public.normalize_profile_cep_digits(p.cep))
--  where public.normalize_profile_cep_digits(p.cep) is not null;

grant execute on function public.normalize_profile_cep_digits(text) to anon, authenticated;
grant execute on function public.format_profile_cep_display(text) to anon, authenticated;
grant execute on function public.apply_cep_address_to_profile(uuid, boolean, boolean) to anon, authenticated;
grant execute on function public.backfill_profiles_address_from_cep(boolean, boolean, integer) to anon, authenticated;
grant select on public.cep_address_cache to anon, authenticated;

notify pgrst, 'reload schema';
