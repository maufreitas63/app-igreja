-- Controle global: app_ativo / app_inativo_msg em app_parameters.
-- Execute no SQL Editor do Supabase (manual). Idempotente.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_app_parameter_sim(p_value text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    lower(
      trim(
        translate(
          coalesce(p_value, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
        )
      )
    ),
    ''
  ) = 'sim';
$$;

create or replace function public.is_app_parameter_nao(p_value text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    lower(
      trim(
        translate(
          coalesce(p_value, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
        )
      )
    ),
    ''
  ) = 'nao';
$$;

create or replace function public.is_app_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_app_parameter_nao(public.get_app_parameter_value('app_ativo')) then false
    else true
  end;
$$;

create or replace function public.get_app_inactive_message()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(public.get_app_parameter_value('app_inativo_msg')), ''),
    'O aplicativo está temporariamente indisponível. Tente novamente mais tarde.'
  );
$$;

create or replace function public.get_app_active_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active', public.is_app_active(),
    'message', public.get_app_inactive_message()
  );
$$;

grant execute on function public.is_app_parameter_sim(text) to anon, authenticated;
grant execute on function public.is_app_parameter_nao(text) to anon, authenticated;
grant execute on function public.is_app_active() to anon, authenticated;
grant execute on function public.get_app_inactive_message() to anon, authenticated;
grant execute on function public.get_app_active_status() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed parâmetros
-- ---------------------------------------------------------------------------

insert into public.app_parameters (parameter, value)
select 'app_ativo', 'sim'
 where not exists (
   select 1
     from public.app_parameters ap
    where lower(trim(ap.parameter)) = lower('app_ativo')
 );

insert into public.app_parameters (parameter, value)
select 'app_inativo_msg',
       'O aplicativo está temporariamente indisponível. Tente novamente mais tarde.'
 where not exists (
   select 1
     from public.app_parameters ap
    where lower(trim(ap.parameter)) = lower('app_inativo_msg')
 );

-- ---------------------------------------------------------------------------
-- ACL: bloqueia acesso quando app inativo (super_admin ignora)
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_access(
  p_profile_id uuid,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
  v_has_roles boolean;
begin
  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  if p_profile_id is not null
     and public.is_super_admin_profile(p_profile_id) then
    return true;
  end if;

  if not public.is_app_active() then
    return false;
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return true;
  end if;

  if p_profile_id is null then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
       and (
         g.profile_id = p_profile_id
         or g.role_id in (
           select par.role_id
             from public.profile_access_roles par
            where par.profile_id = p_profile_id
         )
       )
  )
    into v_allowed;

  if coalesce(v_allowed, false) then
    return true;
  end if;

  select exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
  )
    into v_has_roles;

  if not coalesce(v_has_roles, false) then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  return false;
end;
$$;

notify pgrst, 'reload schema';
