-- =============================================================================
-- Multi-tenancy — onda 4a: match / dedupe / família (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   register-member-atomic.sql / members-accepted-functions.sql
--   members-dedupe-prevent-duplicates.sql
--   members-list-family-sync.sql
--   recepcao-cadastro-familiar.sql
-- Sessão esperada: require_session_tenant_id().
-- Match público (recepção / sync sem sessão):
--   coalesce(current_session_tenant_id(), resolve_default_tenant_id()) + raise se null.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) find_member_id_for_profile_sync
-- Fonte: register-member-atomic.sql (accepted = true)
-- ---------------------------------------------------------------------------
create or replace function public.find_member_id_for_profile_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  select m.id
    into v_id
    from public.members m
   where m.tenant_id = v_tenant
     and m.accepted is true
     and (
       (
         p_phone is not null
         and (
           m.phone = p_phone
           or public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(p_phone)
         )
       )
       or (
         nullif(trim(coalesce(p_full_name, '')), '') is not null
         and lower(trim(coalesce(m.full_name, ''))) = lower(trim(p_full_name))
       )
     )
   order by
     case
       when p_phone is not null and m.phone = p_phone then 0
       when p_phone is not null
         and public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(p_phone) then 1
       else 2
     end,
     m.id
   limit 1;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2) find_member_id_for_recepcao_match
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.find_member_id_for_recepcao_match(
  p_phone text,
  p_full_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_id uuid;
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  if v_full_name is null then
    return null;
  end if;

  select m.id
    into v_id
    from public.members m
   where m.tenant_id = v_tenant
     and lower(trim(coalesce(m.full_name, ''))) = lower(v_full_name)
     and (
       v_phone is null
       or m.phone = v_phone
       or public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(v_phone)
     )
   order by
     case when m.accepted is true then 0 else 1 end,
     case
       when v_phone is not null and m.phone = v_phone then 0
       when v_phone is not null
         and public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(v_phone) then 1
       else 2
     end,
     m.created_at desc nulls last,
     m.id
   limit 1;

  return v_id;
end;
$$;

grant execute on function public.find_member_id_for_recepcao_match(text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3) find_member_id_in_family
-- Fonte: members-dedupe-prevent-duplicates.sql
-- ---------------------------------------------------------------------------
create or replace function public.find_member_id_in_family(
  p_family_id text,
  p_phone text,
  p_full_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_id uuid;
begin
  select m.id
    into v_id
    from public.members m
   where m.tenant_id = v_tenant
     and public.normalize_member_family_id(m.family_id)
       = public.normalize_member_family_id(p_family_id)
     and public.members_match_for_dedupe(
       m.phone,
       m.full_name,
       p_phone,
       p_full_name
     )
   order by
     case when m.accepted is true then 0 else 1 end,
     case when m.birth_date is not null then 0 else 1 end,
     case when public.member_has_valid_phone(m.phone) then 0 else 1 end,
     m.created_at asc,
     m.id
   limit 1;

  return v_id;
end;
$$;

grant execute on function public.find_member_id_in_family(text, text, text)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4) find_profile_id_for_member_sync
-- Fonte: register-member-atomic.sql
-- ---------------------------------------------------------------------------
create or replace function public.find_profile_id_for_member_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  select p.id
    into v_id
    from public.profiles p
   where p.tenant_id = v_tenant
     and (
       (
         p_phone is not null
         and (
           p.phone = p_phone
           or public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone)
         )
       )
       or (
         nullif(trim(coalesce(p_full_name, '')), '') is not null
         and lower(trim(coalesce(p.full_name, ''))) = lower(trim(p_full_name))
       )
     )
   order by
     case
       when p_phone is not null and p.phone = p_phone then 0
       when p_phone is not null
         and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone) then 1
       else 2
     end,
     p.id
   limit 1;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 5) find_profile_id_for_recepcao_match
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.find_profile_id_for_recepcao_match(
  p_phone text,
  p_full_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_id uuid;
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  if v_full_name is null then
    return null;
  end if;

  select p.id
    into v_id
    from public.profiles p
   where p.tenant_id = v_tenant
     and lower(trim(coalesce(p.full_name, ''))) = lower(v_full_name)
     and (
       v_phone is null
       or p.phone = v_phone
       or public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(v_phone)
     )
   order by
     case
       when v_phone is not null and p.phone = v_phone then 0
       when v_phone is not null
         and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(v_phone) then 1
       else 2
     end,
     p.id
   limit 1;

  return v_id;
end;
$$;

grant execute on function public.find_profile_id_for_recepcao_match(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6) members_match_for_dedupe
-- Fonte: members-dedupe-prevent-duplicates.sql
-- Compara apenas strings (phones/names); não consulta tabelas — sem filtro tenant.
-- Isolamento fica nos callers (find_member_id_in_family, merge, etc.).
-- ---------------------------------------------------------------------------
-- create or replace function public.members_match_for_dedupe(...) — sem alteração de corpo.


-- ---------------------------------------------------------------------------
-- 7) merge_members_keep_loser
-- Fonte: members-dedupe-prevent-duplicates.sql
-- ---------------------------------------------------------------------------
create or replace function public.merge_members_keep_loser(
  p_keep_id uuid,
  p_drop_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_keep_tenant uuid;
  v_drop_tenant uuid;
begin
  if p_keep_id is null or p_drop_id is null or p_keep_id = p_drop_id then
    return;
  end if;

  select m.tenant_id
    into v_keep_tenant
    from public.members m
   where m.id = p_keep_id;

  select m.tenant_id
    into v_drop_tenant
    from public.members m
   where m.id = p_drop_id;

  if v_keep_tenant is null or v_drop_tenant is null then
    raise exception 'Membro keep/drop não encontrado para merge.';
  end if;

  if v_keep_tenant is distinct from v_tenant or v_drop_tenant is distinct from v_tenant then
    raise exception 'Merge de membros de outro tenant não permitido.';
  end if;

  if v_keep_tenant is distinct from v_drop_tenant then
    raise exception 'Keep e drop devem pertencer ao mesmo tenant.';
  end if;

  begin
    update public.event_registrations er
       set member_id = p_keep_id
     where er.tenant_id = v_tenant
       and er.member_id = p_drop_id
       and not exists (
         select 1
           from public.event_registrations er2
          where er2.tenant_id = v_tenant
            and er2.event_id = er.event_id
            and er2.member_id = p_keep_id
       );

    delete from public.event_registrations er
     where er.tenant_id = v_tenant
       and er.member_id = p_drop_id;
  exception
    when undefined_column then
      null;
    when undefined_table then
      null;
  end;

  begin
    update public.recepcao_cadastro_familiar r
       set applied_member_id = p_keep_id
     where r.tenant_id = v_tenant
       and r.applied_member_id = p_drop_id;
  exception
    when undefined_column then
      null;
    when undefined_table then
      null;
  end;

  delete from public.members m
   where m.tenant_id = v_tenant
     and m.id = p_drop_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 8) resolve_member_family_id_for_directory_person
-- Fonte: members-list-family-sync.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_member_family_id_for_directory_person(
  p_phone text,
  p_full_name text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_family_id text;
begin
  select upper(trim(m.family_id))
    into v_family_id
    from public.members m
   where m.tenant_id = v_tenant
     and nullif(trim(coalesce(m.family_id, '')), '') is not null
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

  return v_family_id;
end;
$$;

grant execute on function public.resolve_member_family_id_for_directory_person(text, text)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 9) resolve_directory_canonical_family_id
-- Fonte: members-list-family-sync.sql (assinatura text, text, text)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_directory_canonical_family_id(
  p_displayed_family_id text,
  p_phone text,
  p_full_name text default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_result text;
begin
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
    where m.tenant_id = v_tenant
      and nullif(trim(coalesce(m.family_id, '')), '') is not null
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
          where m.tenant_id = v_tenant
            and upper(trim(m.family_id)) = d.family_id
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
  )
    into v_result;

  return v_result;
end;
$$;

grant execute on function public.resolve_directory_canonical_family_id(text, text, text)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 10) resolve_family_id_for_recepcao_person
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_family_id_for_recepcao_person(
  p_phone text,
  p_full_name text,
  out matched_profile_id uuid,
  out matched_member_id uuid,
  out detected_family_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_profile_family text;
  v_member_family text;
  v_phone_family text;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  matched_profile_id := public.find_profile_id_for_recepcao_match(p_phone, p_full_name);
  matched_member_id := public.find_member_id_for_recepcao_match(p_phone, p_full_name);

  if public.recepcao_phone_claimed_by_other_profile(p_phone, p_full_name) then
    matched_profile_id := null;
    matched_member_id := null;
  end if;

  select nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')
    into v_phone_family
    from public.profiles p
   where p.tenant_id = v_tenant
     and nullif(trim(coalesce(p_phone, '')), '') is not null
     and length(public.normalize_phone_for_sync(p_phone)) >= 10
     and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone)
     and nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') is not null
   order by p.updated_at desc nulls last, p.id
   limit 1;

  if matched_profile_id is not null then
    select nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')
      into v_profile_family
      from public.profiles p
     where p.tenant_id = v_tenant
       and p.id = matched_profile_id;
  end if;

  if matched_member_id is not null then
    select nullif(trim(coalesce(m.family_id, '')), '')
      into v_member_family
      from public.members m
     where m.tenant_id = v_tenant
       and m.id = matched_member_id;
  end if;

  detected_family_id := coalesce(v_phone_family, v_member_family, v_profile_family);
end;
$$;

grant execute on function public.resolve_family_id_for_recepcao_person(text, text)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 11) find_family_id_by_phones_in_profiles
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.find_family_id_by_phones_in_profiles(
  p_phones text[]
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_family_id text;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  with input_phones as (
    select distinct public.normalize_phone_for_sync(nullif(trim(phone), '')) as phone_digits
      from unnest(coalesce(p_phones, array[]::text[])) as phone
     where nullif(trim(phone), '') is not null
       and length(public.normalize_phone_for_sync(nullif(trim(phone), ''))) >= 10
  ),
  matched as (
    select distinct nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') as family_id
      from public.profiles p
      join input_phones ip
        on public.normalize_phone_for_sync(p.phone) = ip.phone_digits
     where p.tenant_id = v_tenant
       and nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') is not null
  )
  select family_id
    into v_family_id
    from matched
   where (select count(*) from matched) = 1
   limit 1;

  return v_family_id;
end;
$$;

grant execute on function public.find_family_id_by_phones_in_profiles(text[])
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 12) count_distinct_family_ids_by_phones_in_profiles
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.count_distinct_family_ids_by_phones_in_profiles(
  p_phones text[]
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_count integer;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  with input_phones as (
    select distinct public.normalize_phone_for_sync(nullif(trim(phone), '')) as phone_digits
      from unnest(coalesce(p_phones, array[]::text[])) as phone
     where nullif(trim(phone), '') is not null
       and length(public.normalize_phone_for_sync(nullif(trim(phone), ''))) >= 10
  ),
  matched as (
    select distinct nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') as family_id
      from public.profiles p
      join input_phones ip
        on public.normalize_phone_for_sync(p.phone) = ip.phone_digits
     where p.tenant_id = v_tenant
       and nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') is not null
  )
  select count(*)::integer
    into v_count
    from matched;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.count_distinct_family_ids_by_phones_in_profiles(text[])
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 13) recepcao_phone_claimed_by_other_profile
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.recepcao_phone_claimed_by_other_profile(
  p_phone text,
  p_full_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_claimed boolean;
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone_digits text := public.normalize_phone_for_sync(nullif(trim(coalesce(p_phone, '')), ''));
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  select exists (
    select 1
      from public.profiles p
     where p.tenant_id = v_tenant
       and v_phone_digits is not null
       and length(v_phone_digits) >= 10
       and public.normalize_phone_for_sync(p.phone) = v_phone_digits
       and (
         v_full_name is null
         or lower(trim(coalesce(p.full_name, ''))) <> lower(v_full_name)
       )
  )
    into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

grant execute on function public.recepcao_phone_claimed_by_other_profile(text, text)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 14) resolve_recepcao_lote_family_id
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_recepcao_lote_family_id(p_submission_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_phones text[];
  v_from_phones text;
  v_informant_family text;
  v_distinct_detected int;
  v_single_detected text;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  if p_submission_id is null then
    return null;
  end if;

  select coalesce(array_agg(distinct nullif(trim(r.phone), '')), array[]::text[])
    into v_phones
    from public.recepcao_cadastro_familiar r
   where r.tenant_id = v_tenant
     and r.submission_id = p_submission_id
     and nullif(trim(coalesce(r.phone, '')), '') is not null;

  v_from_phones := public.find_family_id_by_phones_in_profiles(v_phones);

  if v_from_phones is not null then
    return v_from_phones;
  end if;

  select coalesce(
    nullif(trim(coalesce(r.detected_family_id, '')), ''),
    (
      select nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')
        from public.profiles p
       where p.tenant_id = v_tenant
         and p.id = r.matched_profile_id
    ),
    (
      select nullif(trim(coalesce(m.family_id, '')), '')
        from public.members m
       where m.tenant_id = v_tenant
         and m.id = r.matched_member_id
    )
  )
    into v_informant_family
    from public.recepcao_cadastro_familiar r
   where r.tenant_id = v_tenant
     and r.submission_id = p_submission_id
     and r.is_informant is true
   order by r.created_at
   limit 1;

  if v_informant_family is not null then
    return v_informant_family;
  end if;

  select count(distinct nullif(trim(detected_family_id), ''))
    into v_distinct_detected
    from public.recepcao_cadastro_familiar
   where tenant_id = v_tenant
     and submission_id = p_submission_id;

  if v_distinct_detected = 1 then
    select nullif(trim(detected_family_id), '')
      into v_single_detected
      from public.recepcao_cadastro_familiar
     where tenant_id = v_tenant
       and submission_id = p_submission_id
       and detected_family_id is not null
     limit 1;

    return v_single_detected;
  end if;

  return null;
end;
$$;

grant execute on function public.resolve_recepcao_lote_family_id(uuid)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 15) finalize_recepcao_lote_family_assignments
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.finalize_recepcao_lote_family_assignments(
  p_submission_id uuid,
  p_family_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_family_id text;
  v_updated int := 0;
  v_row_count int;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  v_family_id := nullif(trim(coalesce(p_family_id, '')), '');

  if p_submission_id is null or v_family_id is null then
    return 0;
  end if;

  update public.profiles p
     set family_id = v_family_id,
         codigo_membro = v_family_id,
         updated_at = now()
    from public.recepcao_cadastro_familiar r
   where r.tenant_id = v_tenant
     and p.tenant_id = v_tenant
     and r.submission_id = p_submission_id
     and r.status = 'processed'
     and (
       p.id = r.applied_profile_id
       or (
         r.applied_profile_id is null
         and lower(trim(coalesce(p.full_name, ''))) = lower(trim(r.full_name))
         and p.birth_date is not distinct from r.birth_date
       )
     )
     and (
       p.family_id is distinct from v_family_id
       or p.codigo_membro is distinct from v_family_id
     );

  get diagnostics v_row_count = row_count;
  v_updated := v_updated + v_row_count;

  update public.members m
     set family_id = v_family_id
    from public.recepcao_cadastro_familiar r
   where r.tenant_id = v_tenant
     and m.tenant_id = v_tenant
     and r.submission_id = p_submission_id
     and r.status = 'processed'
     and (
       m.id = r.applied_member_id
       or (
         r.applied_member_id is null
         and lower(trim(coalesce(m.full_name, ''))) = lower(trim(r.full_name))
         and m.birth_date is not distinct from r.birth_date
       )
     )
     and m.family_id is distinct from v_family_id;

  get diagnostics v_row_count = row_count;
  v_updated := v_updated + v_row_count;

  update public.recepcao_cadastro_familiar
     set applied_family_id = v_family_id
   where tenant_id = v_tenant
     and submission_id = p_submission_id
     and status = 'processed'
     and applied_family_id is distinct from v_family_id;

  return v_updated;
end;
$$;

grant execute on function public.finalize_recepcao_lote_family_assignments(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
