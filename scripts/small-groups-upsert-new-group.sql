-- Criar outro pequeno grupo: se anfitrião/líder já está em outra célula,
-- devolve mensagem clara e desfaz o cadastro novo (não deixa grupo órfão).

create or replace function public.upsert_small_group_admin(
  p_id uuid default null,
  p_name text default null,
  p_meeting_weekday integer default null,
  p_meeting_time text default null,
  p_host_profile_id uuid default null,
  p_leader_profile_id uuid default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_meetings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_time time;
begin
  if v_actor is null or not public.can_admin_small_groups(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para cadastrar grupos.');
  end if;

  begin
    v_time := nullif(trim(coalesce(p_meeting_time, '')), '')::time;
  exception
    when others then
      return jsonb_build_object('success', false, 'message', 'Horário inválido. Use HH:MM.');
  end;

  if p_id is null then
    if v_name is null then
      return jsonb_build_object('success', false, 'message', 'Informe o nome do grupo.');
    end if;

    insert into public.small_groups (
      tenant_id, name, meeting_weekday, meeting_time,
      host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id
    ) values (
      v_tenant,
      v_name,
      coalesce(p_meeting_weekday, 3),
      coalesce(v_time, time '19:30'),
      p_host_profile_id,
      p_leader_profile_id,
      nullif(trim(coalesce(p_notes, '')), ''),
      coalesce(p_is_active, true),
      v_actor
    )
    returning id into v_id;
  else
    update public.small_groups g
       set name = coalesce(v_name, g.name),
           meeting_weekday = coalesce(p_meeting_weekday, g.meeting_weekday),
           meeting_time = coalesce(v_time, g.meeting_time),
           host_profile_id = p_host_profile_id,
           leader_profile_id = p_leader_profile_id,
           notes = case when p_notes is null then g.notes else nullif(trim(p_notes), '') end,
           is_active = coalesce(p_is_active, g.is_active),
           updated_at = now()
     where g.id = p_id
       and g.tenant_id = v_tenant
    returning g.id into v_id;

    if v_id is null then
      return jsonb_build_object('success', false, 'message', 'Grupo não encontrado nesta igreja.');
    end if;
  end if;

  begin
    perform public.ensure_small_group_core_members(v_id);
    perform public.replace_small_group_meetings(v_id, coalesce(p_meetings, '[]'::jsonb));
  exception
    when unique_violation then
      if p_id is null then
        delete from public.small_groups where id = v_id and tenant_id = v_tenant;
      end if;

      return jsonb_build_object(
        'success',
        false,
        'message',
        'Anfitrião ou líder já participa de outro pequeno grupo. Escolha outra pessoa ou remova-a do grupo atual.'
      );
  end;

  return jsonb_build_object('success', true, 'id', v_id, 'message', 'Grupo salvo.');
end;
$$;

grant execute on function public.upsert_small_group_admin(
  uuid, text, integer, text, uuid, uuid, text, boolean, jsonb
) to anon, authenticated;
