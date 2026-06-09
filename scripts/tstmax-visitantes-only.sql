-- Perfis de teste TstMax: sempre visitantes (mapa, listas, ACL).
-- Execute no SQL Editor do Supabase após access-control-map-pin-roles.sql
-- e access-control-visitantes-role.sql.

-- ---------------------------------------------------------------------------
-- Helper + funções de mapa/lista (idempotente com access-control-map-pin-roles.sql)
-- ---------------------------------------------------------------------------

create or replace function public.profile_is_tstmax_test_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = p_profile_id
       and (
         trim(coalesce(p.full_name, '')) ilike 'TstMax%'
         or coalesce(p.family_id, '') like 'TstMax%'
         or coalesce(p.codigo_membro, '') like 'TstMax%'
         or lower(trim(coalesce(p.email, ''))) like '%@tstmax.demo'
       )
  );
$$;

create or replace function public.profile_is_visitantes_only(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.profile_is_tstmax_test_profile(p_profile_id)
    or not exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p_profile_id
         and ar.code <> 'visitantes'
    );
$$;

create or replace function public.profile_map_role_label(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.profile_is_visitantes_only(p_profile_id) then 'Visitante'
    else coalesce(
      (
        select ar.name
          from public.profile_access_roles par
          join public.access_roles ar on ar.id = par.role_id
         where par.profile_id = p_profile_id
           and ar.code <> 'visitantes'
         order by public.access_role_display_order(ar.code) desc, ar.name asc
         limit 1
      ),
      'Membro'
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- ACL: TstMax usa grants de Visitantes (mesmo com papel member/congregado legado)
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

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return true;
  end if;

  if p_profile_id is null then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  if public.profile_is_tstmax_test_profile(p_profile_id) then
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

-- ---------------------------------------------------------------------------
-- Dados existentes: remover papéis atribuídos aos perfis TstMax
-- ---------------------------------------------------------------------------

delete from public.profile_access_roles par
where par.profile_id in (
  select p.id
    from public.profiles p
   where trim(coalesce(p.full_name, '')) ilike 'TstMax%'
      or coalesce(p.family_id, '') like 'TstMax%'
      or coalesce(p.codigo_membro, '') like 'TstMax%'
      or lower(trim(coalesce(p.email, ''))) like '%@tstmax.demo'
);

grant execute on function public.profile_is_tstmax_test_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
