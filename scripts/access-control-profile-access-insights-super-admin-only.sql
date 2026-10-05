-- Acessos de Usuários (maintenance.card.profile_access_insights): exclusivo super_admin.
-- Remove grants de outros papéis e endurece as RPCs (is_super_admin_profile).

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.card.profile_access_insights',
    'Acessos de Usuários',
    'Card de manutenção com histórico de logins (exclusivo super_admin)',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.profile_access_insights'
 where r.code = 'super_admin'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

delete from public.access_grants g
 using public.access_roles ar, public.access_resources res
 where g.role_id = ar.id
   and g.resource_id = res.id
   and res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.profile_access_insights'
   and ar.code <> 'super_admin';

create or replace function public.list_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns table (
  profile_id uuid,
  full_name text,
  last_access_at timestamptz,
  access_count bigint
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.is_super_admin_profile(p_actor_profile_id) then
    raise exception 'Apenas o Super Administrador pode visualizar Acessos de Usuários.';
  end if;

  return query
  select
    p.id as profile_id,
    p.full_name,
    max(e.accessed_at) as last_access_at,
    count(e.id)::bigint as access_count
  from public.profiles p
  inner join public.profile_app_access_events e on e.profile_id = p.id
  where p.tenant_id = v_tenant
    and coalesce(trim(p.full_name), '') <> ''
    and lower(trim(p.full_name)) <> 'visitante'
  group by p.id, p.full_name
  having count(e.id) > 0
  order by max(e.accessed_at) desc, p.full_name asc;
end;
$list_profile_access_insights_admin$;

create or replace function public.list_profile_access_screen_visits_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  access_event_id uuid,
  accessed_at timestamptz,
  screen_key text,
  screen_label text,
  visited_at timestamptz,
  visit_order integer
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_screen_visits_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.is_super_admin_profile(p_actor_profile_id) then
    raise exception 'Apenas o Super Administrador pode visualizar Acessos de Usuários.';
  end if;

  if p_target_profile_id is null then
    return;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
  ) then
    return;
  end if;

  return query
  select
    e.id as access_event_id,
    e.accessed_at,
    sv.screen_key,
    sv.screen_label,
    sv.visited_at,
    sv.visit_order
  from public.profile_app_access_events e
  left join public.profile_app_access_screen_visits sv
    on sv.access_event_id = e.id
   and sv.screen_label not in ('Dashboard', 'Manutenção')
   and sv.screen_key not in ('/dashboard', '/maintenance-dashboard')
  where e.profile_id = p_target_profile_id
    and e.tenant_id = v_tenant
  order by e.accessed_at desc, sv.visit_order asc nulls last;
end;
$list_profile_access_screen_visits_admin$;

create or replace function public.clear_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $clear_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
  cnt_before bigint;
  cnt_after bigint;
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.is_super_admin_profile(p_actor_profile_id) then
    raise exception 'Apenas o Super Administrador pode limpar Acessos de Usuários.';
  end if;

  select count(*)::bigint
    into cnt_before
    from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  delete from public.profile_app_access_screen_visits sv
   where sv.tenant_id = v_tenant
      or exists (
        select 1
          from public.profile_app_access_events e
         where e.id = sv.access_event_id
           and e.tenant_id = v_tenant
      );

  delete from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  select count(*)::bigint
    into cnt_after
    from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  if cnt_after > 0 then
    raise exception 'Falha ao limpar profile_app_access_events (% registros restantes).', cnt_after;
  end if;

  return coalesce(cnt_before, 0);
end;
$clear_profile_access_insights_admin$;

grant execute on function public.list_profile_access_insights_admin(uuid) to anon, authenticated;
grant execute on function public.list_profile_access_screen_visits_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.clear_profile_access_insights_admin(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
