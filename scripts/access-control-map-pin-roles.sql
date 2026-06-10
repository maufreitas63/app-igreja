-- Papéis ACL no mapa e na lista de membros.
-- Pin azul: visitante (sem papéis em profile_access_roles — fallback automático).
-- Pin vermelho: qualquer perfil com pelo menos um papel atribuído (member, congregado, etc.).
-- Perfis de teste TstMax são sempre tratados como visitantes.
--
-- Execute após access-control-schema.sql e access-control-admin-rpc.sql

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

create or replace function public.fetch_profiles_acl_sync_fingerprint()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::text
    || '|'
    || coalesce(max(par.granted_at)::text, 'none')
    from public.profile_access_roles par;
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

drop function if exists public.list_profiles_visitantes_only_flags();

create or replace function public.list_profiles_visitantes_only_flags()
returns table (
  profile_id uuid,
  is_visitantes_only boolean,
  role_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as profile_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    public.profile_map_role_label(p.id) as role_label
  from public.profiles p;
$$;

drop function if exists public.list_profiles_members_directory();

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
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      nullif(trim(coalesce(p.family_id, '')), ''),
      nullif(trim(coalesce(p.codigo_membro, '')), '')
    ) as family_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and not public.profile_is_visitantes_only(p.id)
  order by trim(p.full_name) asc;
$$;

drop function if exists public.list_profiles_visitors_directory();

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
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      nullif(trim(coalesce(p.family_id, '')), ''),
      nullif(trim(coalesce(p.codigo_membro, '')), '')
    ) as family_id,
    true as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and public.profile_is_visitantes_only(p.id)
  order by trim(p.full_name) asc;
$$;

grant execute on function public.profile_is_tstmax_test_profile(uuid) to anon, authenticated;
grant execute on function public.profile_map_role_label(uuid) to anon, authenticated;
grant execute on function public.profile_is_visitantes_only(uuid) to anon, authenticated;
grant execute on function public.fetch_profiles_acl_sync_fingerprint() to anon, authenticated;
grant execute on function public.list_profiles_visitantes_only_flags() to anon, authenticated;
grant execute on function public.list_profiles_members_directory() to anon, authenticated;
grant execute on function public.list_profiles_visitors_directory() to anon, authenticated;

notify pgrst, 'reload schema';
