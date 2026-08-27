-- Membro sai do próprio pequeno grupo (identidade efetiva / Ghost).
-- Também passa list_my_small_group a enxergar a inscrição (row_security off).

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
      'host', public.small_group_profile_json(v_group.host_profile_id),
      'leader', public.small_group_profile_json(v_group.leader_profile_id)
    )
  );
end;
$$;

grant execute on function public.list_my_small_group() to anon, authenticated;

create or replace function public.leave_small_group_as_member(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_name text;
  v_is_host boolean;
  v_is_leader boolean;
  v_deleted int;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if p_group_id is null then
    return jsonb_build_object('success', false, 'message', 'Informe o grupo.');
  end if;

  select g.name,
         g.host_profile_id is not distinct from v_me,
         g.leader_profile_id is not distinct from v_me
    into v_name, v_is_host, v_is_leader
    from public.small_groups g
   where g.id = p_group_id
     and g.tenant_id = v_tenant;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.');
  end if;

  if v_is_host or v_is_leader then
    return jsonb_build_object(
      'success', false,
      'message', 'Anfitrião ou líder não sai por aqui. Peça à gestão para realocar o grupo.'
    );
  end if;

  delete from public.small_group_members m
   where m.tenant_id = v_tenant
     and m.small_group_id = p_group_id
     and m.profile_id = v_me;

  get diagnostics v_deleted = row_count;

  if v_deleted < 1 then
    return jsonb_build_object('success', true, 'message', 'Você já não participa deste grupo.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Você saiu do grupo "' || v_name || '".'
  );
end;
$$;

grant execute on function public.leave_small_group_as_member(uuid) to anon, authenticated;
