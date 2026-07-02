-- Audiência do evento: todos os integrantes da família em public.members
-- (membros e congregados), sem excluir por membership_out nem por papel congregado.
-- Execute no Supabase após scripts/members-list-family-sync.sql.

drop function if exists public.list_family_event_audience_members(text);

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
  where upper(trim(m.family_id)) = upper(nullif(trim(coalesce(p_family_id, '')), ''))
    and m.accepted is distinct from false
  order by
    public.family_relationship_display_rank(m.relationship),
    trim(m.full_name) asc;
end;
$$;

grant execute on function public.list_family_event_audience_members(text) to anon, authenticated;

drop function if exists public.list_family_profiles_for_event_audience(text);

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
begin
  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    p.birth_date,
    public.profile_directory_family_code(p.family_id, p.codigo_membro) as family_id
  from public.profiles p
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and p.membership_out is null
    and not public.profile_is_visitantes_only(p.id)
    and public.profile_directory_family_code(p.family_id, p.codigo_membro)
      = upper(nullif(trim(coalesce(p_family_id, '')), ''))
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_family_profiles_for_event_audience(text) to anon, authenticated;

notify pgrst, 'reload schema';
