-- Lista de participantes do próprio pequeno grupo (somente nomes).
-- Identidade efetiva (Ghost): current_session_profile_id().
-- Aplica: npx supabase db query --linked -f scripts/small-groups-list-members.sql

create or replace function public.list_my_small_group()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_group public.small_groups%rowtype;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  select g.*
    into v_group
    from public.small_groups g
   where g.tenant_id = v_tenant
     and g.is_active
     and (
       g.leader_profile_id = v_actor
       or g.host_profile_id = v_actor
       or exists (
         select 1
           from public.small_group_members m
          where m.small_group_id = g.id
            and m.profile_id = v_actor
       )
     )
   order by g.name
   limit 1;

  if v_group.id is null then
    return jsonb_build_object('success', true, 'group', null);
  end if;

  return jsonb_build_object(
    'success', true,
    'group', jsonb_build_object(
      'id', v_group.id,
      'name', v_group.name,
      'meeting_weekday', v_group.meeting_weekday,
      'meeting_time', to_char(v_group.meeting_time, 'HH24:MI'),
      'notes', v_group.notes,
      'is_leader', v_group.leader_profile_id = v_actor,
      'is_host', v_group.host_profile_id = v_actor,
      'member_count', (
        select count(*)::int
          from public.small_group_members m
         where m.small_group_id = v_group.id
           and m.tenant_id = v_tenant
      ),
      'host', public.small_group_profile_json(v_group.host_profile_id),
      'leader', public.small_group_profile_json(v_group.leader_profile_id)
    )
  );
end;
$$;

grant execute on function public.list_my_small_group() to anon, authenticated;

create or replace function public.list_my_small_group_members(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'members', '[]'::jsonb);
  end if;

  if p_group_id is null then
    return jsonb_build_object('success', false, 'message', 'Grupo inválido.', 'members', '[]'::jsonb);
  end if;

  if not exists (
    select 1
      from public.small_groups g
     where g.id = p_group_id
       and g.tenant_id = v_tenant
       and g.is_active
       and (
         g.leader_profile_id = v_actor
         or g.host_profile_id = v_actor
         or exists (
           select 1
             from public.small_group_members m
            where m.small_group_id = g.id
              and m.profile_id = v_actor
         )
       )
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'members', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'members',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'full_name', p.full_name
          )
          order by p.full_name
        )
        from public.small_group_members m
        join public.profiles p on p.id = m.profile_id
       where m.small_group_id = p_group_id
         and m.tenant_id = v_tenant
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_my_small_group_members(uuid) to anon, authenticated;
