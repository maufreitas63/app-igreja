-- =============================================================================
-- Multi-tenancy — onda 2a: diretório de membros/famílias (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   members-list-family-sync.sql / members-list-active-membership-out.sql
--   family-event-audience-members.sql
--   sync-managed-member-profile-family-rpc.sql / member-birth-date-kids-teens-sync.sql
--   members-dedupe-prevent-duplicates.sql
--   register-member-atomic.sql
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- list_profiles_family_directory
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
    where p.tenant_id = v_tenant
    and  p.id = p_profile_id
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

grant execute on function public.list_profiles_family_directory(uuid, text, boolean) to anon;
grant execute on function public.list_profiles_family_directory(uuid, text, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- list_profiles_family_directory_by_code
-- ---------------------------------------------------------------------------
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
declare
  v_tenant uuid := public.require_session_tenant_id();
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
    where m.tenant_id = v_tenant
    and  c.family_id is not null
      and upper(trim(m.family_id)) = c.family_id
      and not exists (
        select 1
          from public.profiles p
         where p.tenant_id = v_tenant
    and  p.membership_out is not null
           and public.directory_person_matches_member(
             m.full_name,
             m.phone,
             trim(p.full_name),
             nullif(trim(coalesce(p.phone, '')), '')
           )
      )
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
      and p.membership_out is null
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

grant execute on function public.list_profiles_family_directory_by_code(text, boolean) to anon;
grant execute on function public.list_profiles_family_directory_by_code(text, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- list_profiles_members_directory
-- ---------------------------------------------------------------------------
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
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.tenant_id = v_tenant
    and  p.full_name is not null
    and trim(p.full_name) <> ''
    and p.membership_out is null
    and public.profile_is_members_list_member(p.id)
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_profiles_members_directory() to anon;
grant execute on function public.list_profiles_members_directory() to authenticated;


-- ---------------------------------------------------------------------------
-- list_profiles_visitors_directory
-- ---------------------------------------------------------------------------
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
    true as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.tenant_id = v_tenant
    and  p.full_name is not null
    and trim(p.full_name) <> ''
    and p.membership_out is null
    and public.profile_is_visitantes_only(p.id)
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_profiles_visitors_directory() to anon;
grant execute on function public.list_profiles_visitors_directory() to authenticated;


-- ---------------------------------------------------------------------------
-- list_members_family_directory
-- ---------------------------------------------------------------------------
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
declare
  v_tenant uuid := public.require_session_tenant_id();
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
  where m.tenant_id = v_tenant
    and  upper(trim(m.family_id)) = upper(nullif(trim(coalesce(p_family_id, '')), ''))
    and not exists (
      select 1
        from public.profiles p
       where p.tenant_id = v_tenant
    and  p.membership_out is not null
         and public.directory_person_matches_member(
           m.full_name,
           m.phone,
           trim(p.full_name),
           nullif(trim(coalesce(p.phone, '')), '')
         )
    )
  order by
    public.family_relationship_display_rank(m.relationship),
    trim(m.full_name) asc;
end;
$$;

grant execute on function public.list_members_family_directory(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- list_family_event_audience_members
-- ---------------------------------------------------------------------------
create or replace function public.list_family_event_audience_members(p_family_id text)
returns table (
  member_id uuid,
  full_name text,
  phone text,
  birth_date date,
  relationship text,
  family_id text,
  accepted boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    m.id as member_id,
    trim(m.full_name) as full_name,
    nullif(trim(coalesce(m.phone, '')), '') as phone,
    m.birth_date,
    nullif(trim(coalesce(m.relationship, '')), '') as relationship,
    upper(trim(m.family_id)) as family_id,
    m.accepted
  from public.members m
  where m.tenant_id = v_tenant
    and  upper(trim(m.family_id)) = upper(nullif(trim(coalesce(p_family_id, '')), ''))
    and m.accepted is distinct from false
  order by
    public.family_relationship_display_rank(m.relationship),
    trim(m.full_name) asc;
end;
$$;

grant execute on function public.list_family_event_audience_members(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- list_family_profiles_for_event_audience
-- ---------------------------------------------------------------------------
create or replace function public.list_family_profiles_for_event_audience(p_family_id text)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  birth_date date,
  family_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    p.birth_date,
    public.profile_directory_family_code(p.family_id, p.codigo_membro) as family_id
  from public.profiles p
  where p.tenant_id = v_tenant
    and  p.full_name is not null
    and trim(p.full_name) <> ''
    and p.membership_out is null
    and not public.profile_is_visitantes_only(p.id)
    and public.profile_directory_family_code(p.family_id, p.codigo_membro)
      = upper(nullif(trim(coalesce(p_family_id, '')), ''))
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_family_profiles_for_event_audience(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- accept_managed_member_into_family
-- ---------------------------------------------------------------------------
create or replace function public.accept_managed_member_into_family(
  p_member_id uuid,
  p_target_family_id text,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_member public.members%rowtype;
  v_target_family_id text;
  v_sync_result jsonb;
begin
  select *
    into v_member
  from public.members m
  where m.tenant_id = v_tenant
    and  m.id = p_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado.'
    );
  end if;

  v_target_family_id := upper(trim(coalesce(p_target_family_id, '')));

  if v_target_family_id = '' then
    return jsonb_build_object(
      'success', false,
      'message', 'Código da família de destino inválido.'
    );
  end if;

  update public.members m
  set
    family_id = v_target_family_id,
    accepted = true
  where m.id = p_member_id;

  v_sync_result := public.sync_managed_member_profile_family(p_member_id, p_profile_id);

  return jsonb_build_object(
    'success', true,
    'family_id', v_target_family_id,
    'profile_sync', v_sync_result
  );
end;
$$;

grant execute on function public.accept_managed_member_into_family(uuid, text, uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- detach_managed_member_from_family
-- ---------------------------------------------------------------------------
create or replace function public.detach_managed_member_from_family(
  p_member_id uuid,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_member public.members%rowtype;
  v_new_family_id text;
  v_sync_result jsonb;
begin
  select *
    into v_member
  from public.members m
  where m.tenant_id = v_tenant
    and  m.id = p_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado.'
    );
  end if;

  v_new_family_id := public.reserve_next_family_id();

  update public.members m
  set
    family_id = v_new_family_id,
    accepted = false
  where m.id = p_member_id;

  v_sync_result := public.sync_managed_member_profile_family(p_member_id, p_profile_id);

  return jsonb_build_object(
    'success', true,
    'new_family_id', v_new_family_id,
    'profile_sync', v_sync_result
  );
exception
  when undefined_function then
    return jsonb_build_object(
      'success', false,
      'message', 'Função reserve_next_family_id ausente. Execute scripts/register-member-atomic.sql.'
    );
end;
$$;

grant execute on function public.detach_managed_member_from_family(uuid, uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- upsert_family_member
-- ---------------------------------------------------------------------------
create or replace function public.upsert_family_member(
  p_family_id text,
  p_full_name text,
  p_phone text default null,
  p_birth_date date default null,
  p_relationship text default 'Outros',
  p_accepted boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_family_id text;
  v_full_name text;
  v_phone text;
  v_relationship text;
  v_member_id uuid;
  v_created boolean := false;
  v_member public.members%rowtype;
begin
  v_family_id := public.normalize_member_family_id(p_family_id);
  v_full_name := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone := nullif(trim(coalesce(p_phone, '')), '');
  v_relationship := nullif(trim(coalesce(p_relationship, '')), '');

  if v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Código de família inválido.'
    );
  end if;

  if v_full_name is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nome do integrante é obrigatório.'
    );
  end if;

  if v_relationship is null then
    v_relationship := 'Outros';
  end if;

  v_member_id := public.find_member_id_in_family(v_family_id, v_phone, v_full_name);

  if v_member_id is not null then
    update public.members m
       set full_name = v_full_name,
           phone = coalesce(v_phone, m.phone),
           birth_date = coalesce(p_birth_date, m.birth_date),
           relationship = coalesce(v_relationship, m.relationship),
           family_id = v_family_id,
           accepted = coalesce(p_accepted, m.accepted)
     where m.tenant_id = v_tenant
    and  m.id = v_member_id
     returning * into v_member;
  else
    insert into public.members (
      full_name,
      phone,
      birth_date,
      relationship,
      family_id,
      accepted, tenant_id) values (
      v_full_name,
      v_phone,
      p_birth_date,
      v_relationship,
      v_family_id,
      coalesce(p_accepted, true),
    v_tenant)
    returning * into v_member;

    v_created := true;
  end if;

  return jsonb_build_object(
    'success', true,
    'created', v_created,
    'member_id', v_member.id,
    'member', to_jsonb(v_member)
  );
exception
  when unique_violation then
    v_member_id := public.find_member_id_in_family(v_family_id, v_phone, v_full_name);

    if v_member_id is null then
      return jsonb_build_object(
        'success', false,
        'message', sqlerrm
      );
    end if;

    select * into v_member from public.members where tenant_id = v_tenant
    and id = v_member_id;

    return jsonb_build_object(
      'success', true,
      'created', false,
      'member_id', v_member.id,
      'member', to_jsonb(v_member)
    );
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.upsert_family_member(text, text, text, date, text, boolean)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- sync_managed_member_profile_family
-- ---------------------------------------------------------------------------
create or replace function public.sync_managed_member_profile_family(
  p_member_id uuid,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_member public.members%rowtype;
  v_profile_id uuid;
  v_family_id text;
begin
  select *
    into v_member
  from public.members m
  where m.tenant_id = v_tenant
    and  m.id = p_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado.'
    );
  end if;

  v_family_id := nullif(trim(coalesce(v_member.family_id, '')), '');

  if v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro sem código de família para sincronizar.'
    );
  end if;

  v_profile_id := coalesce(
    p_profile_id,
    public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name)
  );

  if v_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil vinculado ao membro não foi encontrado.'
    );
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id,
    birth_date = coalesce(v_member.birth_date, p.birth_date)
  where p.tenant_id = v_tenant
    and  p.id = v_profile_id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
      or (v_member.birth_date is not null and p.birth_date is distinct from v_member.birth_date)
    );

  if v_member.birth_date is not null then
    perform public.refresh_profile_kids_teens_registrations(v_profile_id, v_member.birth_date);
  end if;

  return jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'family_id', v_family_id
  );
end;
$$;

grant execute on function public.sync_managed_member_profile_family(uuid, uuid) to anon;
grant execute on function public.sync_managed_member_profile_family(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- register_member_atomic
-- ---------------------------------------------------------------------------
create or replace function public.register_member_atomic(
  p_event_id uuid,
  p_member_id uuid,
  p_family_group_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_member members%rowtype;
  v_profile profiles%rowtype;
  v_existing_registration_id uuid;
  v_registration_id uuid;
  v_kids_status text;
  v_resolved_family_id text;
begin
  select *
    into v_member
  from public.members
  where tenant_id = v_tenant
    and id = p_member_id
    and accepted is distinct from false;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado ou não reconhecido pela família.'
    );
  end if;

  if v_member.family_id is not null
     and p_family_group_id is not null
     and v_member.family_id <> p_family_group_id then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não pertence à família informada.'
    );
  end if;

  v_resolved_family_id := coalesce(
    nullif(trim(coalesce(v_member.family_id, '')), ''),
    nullif(trim(coalesce(p_family_group_id, '')), '')
  );

  if v_resolved_family_id is not null
     and v_member.family_id is distinct from v_resolved_family_id then
    update public.members
    set family_id = v_resolved_family_id
    where tenant_id = v_tenant
     and id = v_member.id;

    v_member.family_id := v_resolved_family_id;
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.tenant_id = v_tenant
    and  p.id = public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name)
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil vinculado ao membro não foi encontrado.'
    );
  end if;

  if v_resolved_family_id is not null then
    update public.profiles
    set
      family_id = v_resolved_family_id,
      codigo_membro = v_resolved_family_id,
      birth_date = coalesce(v_member.birth_date, birth_date)
    where tenant_id = v_tenant
     and id = v_profile.id
      and (
        family_id is distinct from v_resolved_family_id
        or codigo_membro is distinct from v_resolved_family_id
        or (v_member.birth_date is not null and birth_date is distinct from v_member.birth_date)
      );
  end if;

  v_kids_status := public.resolve_kids_status_from_birth_date(
    coalesce(v_member.birth_date, v_profile.birth_date)
  );

  select er.id
    into v_existing_registration_id
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
    and er.profile_id = v_profile.id
  limit 1;

  if v_existing_registration_id is not null then
    update public.event_registrations
    set
      family_id = v_resolved_family_id,
      full_name = v_member.full_name,
      kids_status = v_kids_status
    where tenant_id = v_tenant
     and id = v_existing_registration_id;

    perform public.sync_checkin_for_registration(
      p_event_id,
      v_existing_registration_id,
      v_resolved_family_id,
      v_profile.id
    );

    return jsonb_build_object(
      'success', true,
      'message', 'Participante já estava registrado.'
    );
  end if;

  insert into public.event_registrations (
    event_id,
    profile_id,
    family_id,
    full_name,
    kids_status, tenant_id)
  values (
    p_event_id,
    v_profile.id,
    v_resolved_family_id,
    v_member.full_name,
    v_kids_status,
    v_tenant)
  returning id into v_registration_id;

  perform public.sync_checkin_for_registration(
    p_event_id,
    v_registration_id,
    v_resolved_family_id,
    v_profile.id
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Participante registrado com sucesso.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.register_member_atomic(uuid, uuid, text) to anon;
grant execute on function public.register_member_atomic(uuid, uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- unregister_member_atomic
-- ---------------------------------------------------------------------------
create or replace function public.unregister_member_atomic(
  p_event_id uuid,
  p_member_id uuid,
  p_family_group_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_member members%rowtype;
  v_profile_id uuid;
  v_deleted_count integer;
begin
  select *
    into v_member
  from public.members
  where tenant_id = v_tenant
    and id = p_member_id
    and accepted is distinct from false;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado ou não reconhecido pela família.'
    );
  end if;

  if v_member.family_id is not null
     and p_family_group_id is not null
     and v_member.family_id <> p_family_group_id then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não pertence à família informada.'
    );
  end if;

  select public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name)
    into v_profile_id;

  if v_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil vinculado ao membro não foi encontrado.'
    );
  end if;

  delete from public.event_registrations er
  where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
    and er.profile_id = v_profile_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    return jsonb_build_object(
      'success', true,
      'message', 'Participante já não estava registrado.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Participante removido do evento com sucesso.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.unregister_member_atomic(uuid, uuid, text) to anon;
grant execute on function public.unregister_member_atomic(uuid, uuid, text) to authenticated;


notify pgrst, 'reload schema';

commit;
