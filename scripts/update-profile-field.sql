-- Atualiza um campo de `public.profiles` com privilégios controlados,

-- permitindo uso pelo app mesmo quando o acesso é anônimo.

--

-- Execute este script no SQL Editor do Supabase.



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



  if exists (

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

