-- =============================================================================
-- Diretório de Congregados (papel congregado sem papel member)
-- =============================================================================
-- Espelha o critério excluído de profile_is_members_list_member.
-- Execute após multi-tenant wave de members directory.
-- =============================================================================

create or replace function public.profile_is_congregado_directory(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.profile_is_visitantes_only(p_profile_id)
    and exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p_profile_id
         and ar.code = 'congregado'
    )
    and not exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p_profile_id
         and ar.code = 'member'
    );
$$;

grant execute on function public.profile_is_congregado_directory(uuid) to anon, authenticated;

drop function if exists public.list_profiles_congregados_directory();

create or replace function public.list_profiles_congregados_directory()
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  family_id text,
  is_visitantes_only boolean,
  cep text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_has_members_directory_access() then
    return;
  end if;

  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name)),
      public.profile_directory_family_code(p.family_id, p.codigo_membro)
    ) as family_id,
    false as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.tenant_id = v_tenant
    and p.full_name is not null
    and trim(p.full_name) <> ''
    and p.membership_out is null
    and public.profile_is_congregado_directory(p.id)
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_profiles_congregados_directory()
  to anon, authenticated;

notify pgrst, 'reload schema';

select 'list_profiles_congregados_directory: ok' as status;
