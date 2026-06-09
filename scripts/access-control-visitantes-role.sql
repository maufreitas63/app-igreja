-- Papel Visitantes: privilégio padrão sem perfil na sessão ou sem papéis em profile_access_roles.
-- Execute no SQL Editor do Supabase após access-control-schema.sql.

insert into public.access_roles (code, name, description, is_system)
values (
  'visitantes',
  'Visitantes',
  'Acesso público mínimo: login, cadastro e check-in; usado quando não há perfil/papéis na sessão',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- Grants iniciais (ajuste em Manutenção → Controle de Acesso → Papéis → Visitantes).
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/', true, false),
      ('screen', '/register', true, true),
      ('screen', '/lgpd', true, true),
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.event_alt', true, false),
      ('table', 'events', true, false),
      ('table', 'event_registrations', true, true),
      ('table', 'app_parameters', true, false),
      ('table', 'pastoral_reason_categories', true, false),
      ('table', 'pastoral_reason_subcategories', true, false)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'visitantes'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- access_role_display_order: script canônico em access-control-role-display-order.sql

create or replace function public.role_has_access(
  p_role_code text,
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

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return true;
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_roles ar
        on ar.id = g.role_id
       and ar.code = lower(trim(coalesce(p_role_code, '')))
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
  )
    into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

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

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return true;
  end if;

  -- Sem perfil na sessão → papel Visitantes.
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

  -- Perfil sem nenhum papel atribuído → mesmo privilégio de Visitantes.
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

create or replace function public.session_has_resource_access(
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.acl_enforcement_enabled()
    or public.profile_has_access(
      public.current_session_profile_id(),
      lower(trim(coalesce(p_resource_type, ''))),
      trim(coalesce(p_resource_key, '')),
      lower(trim(coalesce(p_action, '')))
    );
$$;

create or replace function public.listar_access_roles_admin(p_actor_profile_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  is_system boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    ar.id,
    ar.code,
    ar.name,
    ar.description,
    ar.is_system
  from public.access_roles ar
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

create or replace function public.listar_papeis_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  role_id uuid,
  role_code text,
  role_name text,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    ar.id as role_id,
    ar.code as role_code,
    ar.name as role_name,
    exists (
      select 1
        from public.profile_access_roles par
       where par.profile_id = p_target_profile_id
         and par.role_id = ar.id
    ) as assigned
  from public.access_roles ar
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

grant execute on function public.role_has_access(text, text, text, text) to anon, authenticated;
grant execute on function public.profile_has_access(uuid, text, text, text) to anon, authenticated;
grant execute on function public.session_has_resource_access(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
