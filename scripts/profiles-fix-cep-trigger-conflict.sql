-- Corrige erro ao salvar CEP+endereço pelo app:
-- "tuple to be updated was already modified by an operation triggered by the current command"
-- Causa: RPC grava endereço completo e o trigger BEFORE em cep tenta alterar a mesma linha.
-- Execute no SQL Editor do Supabase.

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

-- I14: corpo canônico em scripts/profiles-sync-address-from-cep-rpc.sql (reexecute após este patch).

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

  return to_jsonb(v_updated);
end;
$$;

create or replace function public.admin_sync_profile_address_from_cep(
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
begin
  if not public.is_super_admin_profile(p_actor_profile_id) then
    raise exception 'Apenas super administradores podem atualizar o cadastro de outro usuário.';
  end if;

  return public.sync_profile_address_from_cep(
    p_profile_id,
    p_actor_profile_id,
    p_cep,
    p_address_street,
    p_address_neighborhood,
    p_address_city,
    p_address_state,
    p_address_number,
    p_address_complement
  );
end;
$$;

notify pgrst, 'reload schema';
