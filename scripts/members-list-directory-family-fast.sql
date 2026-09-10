-- =============================================================================
-- Lista de membros: family_id do perfil primeiro (evita timeout)
-- =============================================================================
-- Cada linha chamava resolve_member_family_id_for_directory_person (scan em
-- members por telefone/nome). Com ~500 cadastros na IBS a RPC passa de 20s e
-- o cliente aborta — a tela fica sem ninguém.
-- COALESCE curto-circuita: se profiles.family_id já existe, não resolve.
-- Aplica: npx supabase db query --linked -f scripts/members-list-directory-family-fast.sql
-- =============================================================================

create or replace function public.list_profiles_members_directory()
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
set row_security = off
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
      public.profile_directory_family_code(p.family_id, p.codigo_membro),
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name))
    ) as family_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
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
    and not exists (
      select 1
        from public.profile_igreja_vinculos v
       where v.profile_id = p.id
         and v.tenant_id = v_tenant
         and (
           coalesce(v.membership_status, '') = 'Transferido'
           or v.transferred_to_tenant_id is not null
           or v.membership_out is not null
         )
    )
    and public.profile_is_members_list_member(p.id)
  order by trim(p.full_name) asc;
end;
$$;

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
set row_security = off
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
      public.profile_directory_family_code(p.family_id, p.codigo_membro),
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name))
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

create or replace function public.list_profiles_visitors_directory()
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
set row_security = off
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
      public.profile_directory_family_code(p.family_id, p.codigo_membro),
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name))
    ) as family_id,
    true as is_visitantes_only,
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
    and p.is_active is true
    and public.profile_is_visitantes_only(p.id)
  order by trim(p.full_name) asc;
end;
$$;

create or replace function public.list_profiles_members_inactive_directory()
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
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_has_members_directory_access() then
    return;
  end if;

  return query
  with transferred as (
    select v.profile_id
      from public.profile_igreja_vinculos v
     where v.tenant_id = v_tenant
       and (
         coalesce(v.membership_status, '') = 'Transferido'
         or v.transferred_to_tenant_id is not null
         or v.membership_out is not null
       )
  )
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      case
        when p.tenant_id = v_tenant
          then public.profile_directory_family_code(p.family_id, p.codigo_membro)
        else null
      end,
      public.profile_session_origin_family_id(p.id),
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name)),
      '—'
    ) as family_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  left join transferred t on t.profile_id = p.id
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and (
      (p.tenant_id = v_tenant and p.membership_out is not null)
      or t.profile_id is not null
    )
    and (
      public.profile_is_members_list_member(p.id)
      or t.profile_id is not null
    )
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_profiles_members_directory() to anon, authenticated;
grant execute on function public.list_profiles_congregados_directory() to anon, authenticated;
grant execute on function public.list_profiles_visitors_directory() to anon, authenticated;
grant execute on function public.list_profiles_members_inactive_directory() to anon, authenticated;
