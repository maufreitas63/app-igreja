-- CANÔNICO (I14): única fonte de sync_profile_address_from_cep / admin_sync_profile_address_from_cep.
-- Requer: profiles-sync-address-from-cep.sql (normalize_profile_cep_digits, cep_address_cache).
-- Após cep-geolocation-table.sql, este script integra ensure_cep_geolocation quando disponível.
-- Execute no SQL Editor do Supabase.

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

  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'ensure_cep_geolocation'
  ) then
    execute 'select public.ensure_cep_geolocation($1, true)' using v_digits;
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

create or replace function public.update_profile_field(
  p_profile_id uuid,
  p_field text,
  p_value jsonb default 'null'::jsonb,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field text;
  v_actor_id uuid;
  v_column_key text;
  v_updated public.profiles%rowtype;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  v_field := trim(coalesce(p_field, ''));

  if v_field = '' then
    raise exception 'Campo não informado.';
  end if;

  if lower(v_field) = any(array['id', 'created_at', 'updated_at', 'auth_user_id', 'access_pin']) then
    raise exception 'Campo protegido: %', v_field;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = v_field
  ) then
    raise exception 'Campo inexistente em profiles: %', v_field;
  end if;

  v_actor_id := coalesce(p_actor_profile_id, p_profile_id);
  v_column_key := 'profiles.' || v_field;

  if not public.is_super_admin_profile(v_actor_id)
    and exists (
      select 1
        from public.access_resources r
       where r.resource_type = 'column'
         and r.is_active = true
         and public.access_resource_matches(r.resource_key, v_column_key)
    )
    and not public.profile_has_access(v_actor_id, 'column', v_column_key, 'update') then
    raise exception 'Você não tem permissão para alterar este campo.';
  end if;

  execute format(
    'update public.profiles as p
        set %1$I = (jsonb_populate_record(null::public.profiles, jsonb_build_object(%2$L, $1))).%1$I,
            updated_at = now()
      where p.id = $2
      returning p.*',
    v_field,
    v_field
  )
  using p_value, p_profile_id
  into v_updated;

  if v_updated.id is null then
    raise exception 'Perfil não encontrado ou sem permissão para atualizar.';
  end if;

  if lower(v_field) = 'cep'
    and public.normalize_profile_cep_digits(v_updated.cep) is not null then
    perform public.apply_cep_address_to_profile(p_profile_id, true, true);

    select *
      into v_updated
      from public.profiles p
     where p.id = p_profile_id;
  end if;

  return to_jsonb(v_updated);
end;
$$;

grant execute on function public.sync_profile_address_from_cep(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;
grant execute on function public.admin_sync_profile_address_from_cep(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;
grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
