-- Corrige lista vazia/incompleta no card Mudança de Papéis.
-- Causa: family_acceptor, lider e events_admin eram tratados como "protegidos"
-- e escondiam membros comuns (ex.: representante legal com member + family_acceptor).
--
-- Execute no SQL Editor do Supabase após access-control-pastoral-role-change.sql.

create or replace function public.profile_has_protected_role_for_pastoral_change(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code in ('super_admin', 'pastoral')
  );
$$;

-- Conferência: membros com family_acceptor devem aparecer na lista
select
  p.id,
  p.full_name,
  p.phone,
  public.resolve_basic_role_code_for_profile(p.id) as basic_role,
  public.profile_has_protected_role_for_pastoral_change(p.id) as is_protected,
  (
    select string_agg(ar.code, ', ' order by ar.code)
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p.id
  ) as roles
from public.profiles p
where exists (
  select 1
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
   where par.profile_id = p.id
     and ar.code = 'member'
)
and exists (
  select 1
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
   where par.profile_id = p.id
     and ar.code = 'family_acceptor'
)
order by p.full_name
limit 20;

notify pgrst, 'reload schema';
