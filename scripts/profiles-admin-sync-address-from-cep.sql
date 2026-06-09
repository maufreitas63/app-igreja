-- Super admin: sincroniza CEP + endereço de qualquer perfil (app Manutenção → Cadastro de Usuário).
-- Também corrige update_profile_field para super_admin em colunas de profiles.
-- Execute no SQL Editor do Supabase.

-- ---------------------------------------------------------------------------
-- super_admin pode editar qualquer coluna de profiles via update_profile_field
-- ---------------------------------------------------------------------------

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

  return to_jsonb(v_updated);
end;
$$;

-- Grant explícito: super_admin em column profiles.*
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'column'
   and res.resource_key = 'profiles.*'
 where r.code = 'super_admin'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- RPC: grava CEP + endereço em lote (dados vindos do ViaCEP no app)
-- ---------------------------------------------------------------------------

drop function if exists public.admin_sync_profile_address_from_cep(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.admin_sync_profile_address_from_cep(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

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
    raise exception 'Apenas super administradores podem atualizar o cadastro de outro usuário.';
  end if;

  v_digits := public.normalize_profile_cep_digits(p_cep);

  if v_digits is null then
    raise exception 'CEP inválido. Informe 8 dígitos (ex.: 11677-040).';
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
    'admin_app'
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

grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to anon, authenticated;
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

notify pgrst, 'reload schema';
