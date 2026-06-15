-- Hotfix: profile_has_access chama role_has_access('visitantes', ...) mas a função não existia.
-- Erro típico ao testar list_members_family_directory:
--   function public.role_has_access(unknown, text, text, text) does not exist
--
-- Execute antes de members-list-family-sync.sql se o erro persistir isoladamente.
-- Canônico: access-control-schema.sql ou access-control-visitantes-role.sql

create or replace function public.access_resource_matches(
  p_grant_key text,
  p_requested_key text
)
returns boolean
language sql
immutable
as $$
  select
    p_grant_key = p_requested_key
    or p_grant_key = '*'
    or (
      right(p_grant_key, 2) = '.*'
      and left(p_requested_key, length(p_grant_key) - 1) = left(p_grant_key, length(p_grant_key) - 2)
    );
$$;

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

grant execute on function public.role_has_access(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
