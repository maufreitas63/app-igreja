-- Lista de Famílias: inclui o papel básico do perfil (visitante / congregado / membro).
-- Execute: npx supabase db query --linked -f scripts/list-tenant-family-directory.sql

drop function if exists public.list_tenant_family_directory();

create or replace function public.list_tenant_family_directory()
returns table (
  id uuid,
  family_id text,
  full_name text,
  relationship text,
  phone text,
  birth_date date,
  marriage_date date,
  accepted boolean,
  role_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_prefix text;
begin
  if v_tenant is null or public.current_session_profile_id() is null then
    return;
  end if;

  if not (
    public.session_has_resource_access('screen', 'dashboard.card.members_list', 'view')
    or public.session_has_resource_access('table', 'members', 'view')
  ) then
    return;
  end if;

  v_prefix := upper(trim(coalesce(public.get_family_id_prefix(), '')));

  return query
  select
    m.id,
    upper(trim(m.family_id)) as family_id,
    trim(m.full_name) as full_name,
    coalesce(nullif(trim(m.relationship), ''), '') as relationship,
    nullif(trim(coalesce(m.phone, '')), '') as phone,
    m.birth_date,
    m.marriage_date,
    m.accepted,
    case
      when v_profile.id is null then null
      else public.resolve_basic_role_code_for_profile(v_profile.id)
    end as role_code
  from public.members m
  left join lateral (
    select public.find_profile_id_for_member_sync(m.phone, m.full_name) as id
  ) v_profile on true
  where m.tenant_id = v_tenant
    and nullif(trim(m.family_id), '') is not null
    and nullif(trim(m.full_name), '') is not null
    and (
      v_prefix = ''
      or upper(trim(m.family_id)) like v_prefix || '%'
    )
  order by upper(trim(m.family_id)), trim(m.full_name);
end;
$$;

grant execute on function public.list_tenant_family_directory() to anon, authenticated;

notify pgrst, 'reload schema';
