-- Exibe o papel real do perfil no mapa (ex.: Congregado, Membro, Líder).
-- Execute no SQL Editor do Supabase.
-- access_role_display_order: script canônico em access-control-role-display-order.sql

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

grant execute on function public.profile_map_role_label(uuid) to anon, authenticated;
grant execute on function public.list_profiles_visitantes_only_flags() to anon, authenticated;

notify pgrst, 'reload schema';
