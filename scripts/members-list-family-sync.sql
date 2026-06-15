-- Correção members_list: family_id da lista alinhado a members + modal por código familiar.
-- Causa: profiles.family_id divergente de members.family_id (recepção); modal buscava código errado;
--        fallback direto em members bloqueado por RLS; access-control-security-hardening.sql (C4)
--        sobrescrevia estes RPCs com family_id só de profiles e ACL só do mapa.
--
-- Execute no SQL Editor do Supabase DEPOIS de access-control-security-hardening.sql (autossuficiente).
-- Reparo de dados existentes: scripts/sync-profiles-family-from-members.sql
-- Se der erro role_has_access does not exist: este script recria a função abaixo.

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

create or replace function public.session_has_members_directory_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.session_has_screen_access('/mapa-geolocalizacao', 'view')
    or public.session_has_screen_access('dashboard.card.members_list', 'view');
$$;

create or replace function public.normalize_profile_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
$$;

create or replace function public.phones_match_for_sync(p_phone_a text, p_phone_b text)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  with normalized as (
    select
      public.normalize_profile_phone(p_phone_a) as a_digits,
      public.normalize_profile_phone(p_phone_b) as b_digits
  ),
  variants as (
    select
      a_digits,
      b_digits,
      case
        when a_digits like '55%' and length(a_digits) >= 12 then substring(a_digits from 3)
        else a_digits
      end as a_local,
      case
        when b_digits like '55%' and length(b_digits) >= 12 then substring(b_digits from 3)
        else b_digits
      end as b_local
    from normalized
  )
  select
    a_digits is not null
    and b_digits is not null
    and (
      a_digits = b_digits
      or a_digits = b_local
      or a_local = b_digits
      or a_local = b_local
      or a_digits = '55' || b_local
      or b_digits = '55' || a_local
      or trim(coalesce(p_phone_a, '')) = trim(coalesce(p_phone_b, ''))
    )
  from variants;
$$;

create or replace function public.profile_directory_family_code(
  p_family_id text,
  p_codigo_membro text
)
returns text
language sql
immutable
as $$
  select upper(nullif(trim(coalesce(
    nullif(trim(coalesce(p_family_id, '')), ''),
    nullif(trim(coalesce(p_codigo_membro, '')), '')
  )), ''));
$$;

create or replace function public.directory_person_matches_member(
  p_member_name text,
  p_member_phone text,
  p_person_name text,
  p_person_phone text
)
returns boolean
language sql
immutable
as $$
  select
    (
      nullif(trim(coalesce(p_person_phone, '')), '') is not null
      and public.phones_match_for_sync(p_member_phone, p_person_phone)
    )
    or (
      length(trim(coalesce(p_member_name, ''))) > 0
      and length(trim(coalesce(p_person_name, ''))) > 0
      and lower(trim(p_member_name)) = lower(trim(p_person_name))
    );
$$;

create or replace function public.family_relationship_display_rank(p_relationship text)
returns integer
language sql
immutable
as $$
  select case lower(trim(translate(
    coalesce(p_relationship, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  )))
    when 'representante legal' then 0
    when 'conjuge' then 1
    when 'cônjuge' then 1
    when 'filho(a)' then 2
    when 'filho' then 2
    when 'filha' then 2
    when 'pai' then 3
    when 'mae' then 4
    when 'mãe' then 4
    when 'outros' then 5
    else 99
  end;
$$;

-- Família canônica do integrante: members (telefone/nome) tem precedência sobre profiles.
create or replace function public.resolve_member_family_id_for_directory_person(
  p_phone text,
  p_full_name text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select upper(trim(m.family_id))
    from public.members m
   where nullif(trim(coalesce(m.family_id, '')), '') is not null
     and (
       (
         nullif(trim(coalesce(p_phone, '')), '') is not null
         and public.phones_match_for_sync(m.phone, p_phone)
       )
       or (
         length(trim(coalesce(p_full_name, ''))) > 0
         and lower(trim(m.full_name)) = lower(trim(p_full_name))
       )
     )
   order by
     case when m.accepted is true then 0 else 1 end,
     m.created_at desc nulls last,
     m.id
   limit 1;
$$;

drop function if exists public.resolve_directory_canonical_family_id(text, text);
drop function if exists public.resolve_directory_canonical_family_id(text, text, text);

create or replace function public.resolve_directory_canonical_family_id(
  p_displayed_family_id text,
  p_phone text,
  p_full_name text default null
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with displayed as (
    select upper(nullif(trim(coalesce(p_displayed_family_id, '')), '')) as family_id
  ),
  member_for_person as (
    select public.resolve_member_family_id_for_directory_person(p_phone, p_full_name) as family_id
  ),
  phone_members as (
    select
      upper(trim(m.family_id)) as family_id,
      count(*)::integer as match_count
    from public.members m
    where nullif(trim(coalesce(m.family_id, '')), '') is not null
      and nullif(trim(coalesce(p_phone, '')), '') is not null
      and public.phones_match_for_sync(m.phone, p_phone)
    group by upper(trim(m.family_id))
  ),
  members_with_displayed_family as (
    select d.family_id
      from displayed d
     where d.family_id is not null
       and exists (
         select 1
           from public.members m
          where upper(trim(m.family_id)) = d.family_id
       )
     limit 1
  ),
  preferred as (
    select pm.family_id
      from phone_members pm
      cross join displayed d
     where d.family_id is not null
       and pm.family_id = d.family_id
     limit 1
  ),
  majority as (
    select pm.family_id
      from phone_members pm
     order by pm.match_count desc, pm.family_id asc
     limit 1
  )
  select coalesce(
    (select family_id from member_for_person where family_id is not null),
    (select family_id from preferred),
    (select family_id from members_with_displayed_family),
    (select family_id from majority),
    (select family_id from displayed)
  );
$$;

-- Lista do card: exibe family_id de members quando houver vínculo por telefone/nome.
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
    and not public.profile_is_visitantes_only(p.id)
  order by trim(p.full_name) asc;
end;
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
end;
$$;

-- Fallback seguro (security definer) quando consulta direta a members é bloqueada por RLS.
drop function if exists public.list_members_family_directory(text);

create or replace function public.list_members_family_directory(p_family_id text)
returns table (
  member_id uuid,
  full_name text,
  phone text,
  relationship text,
  family_id text
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
    m.id as member_id,
    trim(m.full_name) as full_name,
    nullif(trim(coalesce(m.phone, '')), '') as phone,
    nullif(trim(coalesce(m.relationship, '')), '') as relationship,
    upper(trim(m.family_id)) as family_id
  from public.members m
  where upper(trim(m.family_id)) = upper(nullif(trim(coalesce(p_family_id, '')), ''))
  order by
    public.family_relationship_display_rank(m.relationship),
    trim(m.full_name) asc;
end;
$$;

-- Modal: busca direta por código familiar (ex.: IBN0103).
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
      and public.profile_is_visitantes_only(p.id) = p_visitors_only
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
  order by
    public.family_relationship_display_rank(m.relationship),
    m.full_name asc;
end;
$$;

drop function if exists public.list_profiles_family_directory(uuid, boolean);
drop function if exists public.list_profiles_family_directory(uuid, text, boolean);

create or replace function public.list_profiles_family_directory(
  p_profile_id uuid,
  p_displayed_family_id text default null,
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
declare
  v_family_id text;
begin
  if not public.session_has_members_directory_access() then
    return;
  end if;

  with seed as (
    select
      p.id as profile_id,
      trim(p.full_name) as full_name,
      nullif(trim(coalesce(p.phone, '')), '') as phone,
      coalesce(
        public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name)),
        public.profile_directory_family_code(p.family_id, p.codigo_membro),
        upper(nullif(trim(coalesce(p_displayed_family_id, '')), ''))
      ) as displayed_family_id
    from public.profiles p
    where p.id = p_profile_id
      and p.full_name is not null
      and trim(p.full_name) <> ''
  ),
  canonical as (
    select coalesce(
      (
        select public.resolve_directory_canonical_family_id(
          s.displayed_family_id,
          s.phone,
          s.full_name
        )
        from seed s
      ),
      upper(nullif(trim(coalesce(p_displayed_family_id, '')), ''))
    ) as family_id
  )
  select c.family_id
    into v_family_id
    from canonical c;

  return query
  select *
    from public.list_profiles_family_directory_by_code(v_family_id, p_visitors_only);
end;
$$;

grant execute on function public.session_has_members_directory_access() to anon, authenticated;
grant execute on function public.role_has_access(text, text, text, text) to anon, authenticated;
grant execute on function public.resolve_member_family_id_for_directory_person(text, text) to anon, authenticated;
grant execute on function public.resolve_directory_canonical_family_id(text, text, text) to anon, authenticated;
grant execute on function public.list_members_family_directory(text) to anon, authenticated;
grant execute on function public.list_profiles_family_directory_by_code(text, boolean) to anon, authenticated;
grant execute on function public.list_profiles_family_directory(uuid, text, boolean) to anon, authenticated;
grant execute on function public.list_profiles_members_directory() to anon, authenticated;
grant execute on function public.list_profiles_visitors_directory() to anon, authenticated;

notify pgrst, 'reload schema';
