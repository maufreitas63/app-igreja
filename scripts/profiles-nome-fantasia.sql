-- Nome fantasia em profiles + parâmetro n_fantasia + RPCs de diretório.
-- Reexecutável.

alter table public.profiles
  add column if not exists nome_fantasia text;

comment on column public.profiles.nome_fantasia is
  'Nome de exibição opcional; usado quando app_parameters.n_fantasia = sim.';

insert into public.app_parameters (parameter, value)
values ('n_fantasia', 'não')
on conflict (parameter) do nothing;

insert into public.access_resources (resource_type, resource_key, label)
values ('column', 'profiles.nome_fantasia', 'Nome fantasia')
on conflict (resource_type, resource_key) do nothing;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
from public.access_roles r
cross join public.access_resources res
where r.role_key in ('super_admin', 'member')
  and res.resource_key = 'profiles.nome_fantasia'
  and not exists (
    select 1
    from public.access_grants g
    where g.role_id = r.id
      and g.resource_id = res.id
  );

drop function if exists public.list_profiles_members_directory();

create or replace function public.list_profiles_members_directory()
returns table (
  profile_id uuid,
  full_name text,
  nome_fantasia text,
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
    nullif(trim(coalesce(p.nome_fantasia, '')), '') as nome_fantasia,
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
  nome_fantasia text,
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
    nullif(trim(coalesce(p.nome_fantasia, '')), '') as nome_fantasia,
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

grant execute on function public.list_profiles_members_directory() to anon, authenticated;
grant execute on function public.list_profiles_visitors_directory() to anon, authenticated;
