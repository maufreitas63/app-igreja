-- Sincroniza `members.family_id` com `profiles.family_id` e `profiles.codigo_membro`.
-- Execute este script no SQL Editor do Supabase.
-- A sincronização passa a funcionar nos dois sentidos para o vínculo de família.

alter table public.profiles
  add column if not exists family_id text;

do $$
declare
  v_index record;
begin
  begin
    alter table public.profiles
      drop constraint if exists profiles_codigo_membro_key;
  exception
    when undefined_object then
      null;
  end;

  for v_index in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexdef ilike 'create unique index%'
      and indexdef ilike '%(codigo_membro)%'
  loop
    execute format('drop index if exists public.%I', v_index.indexname);
  end loop;
end
$$;

create index if not exists idx_profiles_family_id
  on public.profiles (family_id);

create index if not exists idx_profiles_codigo_membro
  on public.profiles (codigo_membro);

drop trigger if exists trg_sync_profile_family_from_member on public.members;
drop trigger if exists trg_sync_member_family_from_profile on public.profiles;

drop function if exists public.sync_profile_family_from_member();
drop function if exists public.sync_member_family_from_profile();
drop function if exists public.find_profile_id_for_member_sync(text, text);
drop function if exists public.find_member_id_for_profile_sync(text, text);
drop function if exists public.normalize_phone_for_sync(text);

create or replace function public.normalize_phone_for_sync(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
$$;

create or replace function public.find_profile_id_for_member_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
set search_path = public
as $$
  select p.id
  from public.profiles p
  where
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
  order by
    case
      when p_phone is not null and p.phone = p_phone then 0
      when p_phone is not null and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone) then 1
      else 2
    end,
    p.id
  limit 1;
$$;

create or replace function public.find_member_id_for_profile_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
set search_path = public
as $$
  select m.id
  from public.members m
  where
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
  order by
    case
      when p_phone is not null and m.phone = p_phone then 0
      when p_phone is not null and public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(p_phone) then 1
      else 2
    end,
    m.id
  limit 1;
$$;

update public.profiles p
set
  family_id = synced.family_id,
  codigo_membro = synced.family_id
from (
  select
    id,
    coalesce(nullif(trim(family_id), ''), nullif(trim(codigo_membro), '')) as family_id
  from public.profiles
) as synced
where p.id = synced.id
  and synced.family_id is not null
  and (
    p.family_id is distinct from synced.family_id
    or p.codigo_membro is distinct from synced.family_id
  );

with matched_profiles as (
  select
    m.id as member_id,
    public.find_profile_id_for_member_sync(m.phone, m.full_name) as profile_id,
    nullif(trim(m.family_id), '') as family_id
  from public.members m
)
update public.profiles p
set
  family_id = matched_profiles.family_id,
  codigo_membro = matched_profiles.family_id
from matched_profiles
where p.id = matched_profiles.profile_id
  and matched_profiles.family_id is not null
  and (
    p.family_id is distinct from matched_profiles.family_id
    or p.codigo_membro is distinct from matched_profiles.family_id
  );

with matched_members as (
  select
    p.id as profile_id,
    public.find_member_id_for_profile_sync(p.phone, p.full_name) as member_id,
    coalesce(nullif(trim(p.family_id), ''), nullif(trim(p.codigo_membro), '')) as family_id
  from public.profiles p
)
update public.members m
set family_id = matched_members.family_id
from matched_members
where m.id = matched_members.member_id
  and matched_members.family_id is not null
  and m.family_id is distinct from matched_members.family_id;

create or replace function public.sync_profile_family_from_member()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_family_id text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_profile_id := public.find_profile_id_for_member_sync(new.phone, new.full_name);
  v_family_id := nullif(trim(coalesce(new.family_id, '')), '');

  if v_profile_id is null then
    return new;
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.id = v_profile_id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  return new;
end;
$$;

create or replace function public.sync_member_family_from_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_member_id uuid;
  v_family_id text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if
    tg_op = 'UPDATE'
    and new.codigo_membro is distinct from old.codigo_membro
    and new.family_id is not distinct from old.family_id
  then
    v_family_id := nullif(trim(coalesce(new.codigo_membro, '')), '');
  elsif tg_op = 'UPDATE' and new.family_id is distinct from old.family_id then
    v_family_id := nullif(trim(coalesce(new.family_id, '')), '');
  else
    v_family_id := coalesce(
      nullif(trim(coalesce(new.family_id, '')), ''),
      nullif(trim(coalesce(new.codigo_membro, '')), '')
    );
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.id = new.id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  v_member_id := public.find_member_id_for_profile_sync(new.phone, new.full_name);

  if v_member_id is null then
    return new;
  end if;

  update public.members m
  set family_id = v_family_id
  where m.id = v_member_id
    and m.family_id is distinct from v_family_id;

  return new;
end;
$$;

create trigger trg_sync_profile_family_from_member
after insert or update of family_id, phone, full_name
on public.members
for each row
execute function public.sync_profile_family_from_member();

create trigger trg_sync_member_family_from_profile
after insert or update of family_id, codigo_membro, phone, full_name
on public.profiles
for each row
execute function public.sync_member_family_from_profile();
