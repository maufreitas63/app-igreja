-- Exclui perfis com papel Congregado (sem papel Membro) da lista de membros do dashboard.
-- Execute no Supabase após scripts/members-list-family-sync.sql (ou access-control-security-hardening.sql).

create or replace function public.profile_is_members_list_member(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.profile_is_visitantes_only(p_profile_id)
    and not (
      exists (
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
      )
    );
$$;

grant execute on function public.profile_is_members_list_member(uuid) to anon, authenticated;

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
language plpgsql
stable
security definer
set search_path = public
as $$
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
    and public.profile_is_members_list_member(p.id)
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_profiles_members_directory() to anon, authenticated;

drop function if exists public.list_profiles_family_directory_by_code(text, boolean);

create or replace function public.list_profiles_family_directory_by_code(
  p_family_id text,
  p_visitors_only boolean default false
)
returns table (
  profile_id uuid,
  member_id uuid,
  full_name text,
  phone text,
  family_id text,
  relationship text,
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
begin
  if not public.session_has_members_directory_access() then
    return;
  end if;

  return query
  with canonical as (
    select upper(nullif(trim(coalesce(p_family_id, '')), '')) as family_id
  ),
  family_members as (
    select
      m.id,
      trim(m.full_name) as full_name,
      nullif(trim(coalesce(m.phone, '')), '') as phone,
      nullif(trim(coalesce(m.relationship, '')), '') as relationship
    from public.members m
    cross join canonical c
    where c.family_id is not null
      and upper(trim(m.family_id)) = c.family_id
  ),
  directory_profiles as (
    select
      p.id as profile_id,
      trim(p.full_name) as full_name,
      nullif(trim(coalesce(p.phone, '')), '') as phone,
      public.profile_directory_family_code(p.family_id, p.codigo_membro) as displayed_family_id,
      nullif(trim(coalesce(p.cep, '')), '') as cep,
      nullif(trim(coalesce(p.address_street, '')), '') as address_street,
      nullif(trim(coalesce(p.address_number, '')), '') as address_number,
      nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
      nullif(trim(coalesce(p.address_city, '')), '') as address_city,
      nullif(trim(coalesce(p.address_state, '')), '') as address_state
    from public.profiles p
    cross join canonical c
    where c.family_id is not null
      and p.full_name is not null
      and trim(p.full_name) <> ''
      and (
        (p_visitors_only and public.profile_is_visitantes_only(p.id))
        or (not p_visitors_only and public.profile_is_members_list_member(p.id))
      )
      and (
        public.profile_directory_family_code(p.family_id, p.codigo_membro) = c.family_id
        or exists (
          select 1
            from family_members fm
           where public.directory_person_matches_member(
             fm.full_name,
             fm.phone,
             trim(p.full_name),
             nullif(trim(coalesce(p.phone, '')), '')
           )
        )
      )
  ),
  member_rows as (
    select distinct on (fm.id)
      dp.profile_id,
      fm.id as member_id,
      fm.full_name,
      coalesce(dp.phone, fm.phone) as phone,
      c.family_id,
      fm.relationship,
      dp.cep,
      dp.address_street,
      dp.address_number,
      dp.address_neighborhood,
      dp.address_city,
      dp.address_state
    from family_members fm
    cross join canonical c
    left join directory_profiles dp
      on public.directory_person_matches_member(
        fm.full_name,
        fm.phone,
        dp.full_name,
        dp.phone
      )
    order by fm.id, dp.profile_id nulls last
  ),
  profile_only_rows as (
    select
      dp.profile_id,
      null::uuid as member_id,
      dp.full_name,
      dp.phone,
      c.family_id,
      null::text as relationship,
      dp.cep,
      dp.address_street,
      dp.address_number,
      dp.address_neighborhood,
      dp.address_city,
      dp.address_state
    from directory_profiles dp
    cross join canonical c
    where not exists (
      select 1
        from family_members fm
       where public.directory_person_matches_member(
         fm.full_name,
         fm.phone,
         dp.full_name,
         dp.phone
       )
    )
  ),
  merged as (
    select * from member_rows
    union all
    select * from profile_only_rows
  )
  select
    m.profile_id,
    m.member_id,
    m.full_name,
    m.phone,
    m.family_id,
    m.relationship,
    m.cep,
    m.address_street,
    m.address_number,
    m.address_neighborhood,
    m.address_city,
    m.address_state
  from merged m
  where m.full_name is not null
    and trim(m.full_name) <> ''
    and m.family_id is not null
    and (
      p_visitors_only
      or m.profile_id is null
      or public.profile_is_members_list_member(m.profile_id)
    )
  order by
    public.family_relationship_display_rank(m.relationship),
    m.full_name asc;
end;
$$;

grant execute on function public.list_profiles_family_directory_by_code(text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
