-- Passo 9d: valida can_update nas RPCs que gravam profiles.
-- Execute no SQL Editor do Supabase após access-control-schema.sql.

drop function if exists public.update_profile_field(uuid, text, jsonb);

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

grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to anon;
grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to authenticated;

create or replace function public.update_profile_access_pin(
  p_phone text,
  p_current_pin text,
  p_new_pin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current text;
  v_new text;
  v_stored text;
begin
  v_current := nullif(trim(coalesce(p_current_pin, '')), '');
  v_new := nullif(trim(coalesce(p_new_pin, '')), '');

  if v_current is null or v_current !~ '^[0-9]{4}$' then
    raise exception 'Informe a senha atual com 4 dígitos.';
  end if;

  if v_new is null or v_new !~ '^[0-9]{4}$' then
    raise exception 'A nova senha deve ter 4 dígitos.';
  end if;

  if v_current = v_new then
    raise exception 'A nova senha deve ser diferente da atual.';
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    raise exception 'Perfil não encontrado para este celular.';
  end if;

  if not public.profile_has_access(v_profile_id, 'column', 'profiles.access_pin', 'update') then
    raise exception 'Você não tem permissão para alterar a senha de acesso.';
  end if;

  select p.access_pin
    into v_stored
    from public.profiles p
   where p.id = v_profile_id;

  if v_stored is null then
    raise exception 'Senha ainda não definida. Solicite um código pelo WhatsApp na tela de entrada.';
  end if;

  if v_stored <> v_current then
    raise exception 'Senha atual incorreta.';
  end if;

  update public.profiles
     set access_pin = v_new,
         updated_at = now()
   where id = v_profile_id;
end;
$$;

grant execute on function public.update_profile_access_pin(text, text, text) to anon;
grant execute on function public.update_profile_access_pin(text, text, text) to authenticated;
