-- Check-out após liberação: mantém room_released=true para a criança sair da lista.
-- Check-in novo: zera room_released.

create or replace function public.set_event_registration_room_entry(
  p_registration_id uuid,
  p_room_entry_checked boolean,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date timestamptz;
  v_service_date date;
  v_kids_status text;
  v_checked boolean := coalesce(p_room_entry_checked, false);
begin
  select er.kids_status, ev.event_date
    into v_kids_status, v_event_date
    from public.event_registrations er
    join public.events ev on ev.id = er.event_id
   where er.id = p_registration_id;

  if v_kids_status is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Inscrição do evento não encontrada.'
    );
  end if;

  if v_kids_status not in ('KIDS', 'TEENS') then
    return jsonb_build_object(
      'success', false,
      'message', 'Esta inscrição não pertence a IBN KIDS ou IBN TEENS.'
    );
  end if;

  v_service_date := (v_event_date at time zone 'America/Sao_Paulo')::date;

  if p_actor_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Sessão inválida. Saia e entre novamente no aplicativo.'
    );
  end if;

  if not public.profile_is_room_servidor_on_date(p_actor_profile_id, v_kids_status, v_service_date) then
    return jsonb_build_object(
      'success', false,
      'message',
      'Somente Secretaria, Super Admin ou servidores escalados para esta sala na data do evento podem registrar o check-in.'
    );
  end if;

  update public.event_registrations
     set room_entry_checked = v_checked,
         -- Check-in limpa liberação; check-out após liberar mantém o flag (baixa / some da lista).
         room_released = case
           when v_checked then false
           else room_released
         end
   where id = p_registration_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Inscrição do evento não encontrada.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when v_checked then 'Entrada na sala atualizada com sucesso.'
      else 'Check-out / baixa na sala atualizado com sucesso.'
    end
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.set_event_registration_room_entry(uuid, boolean, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
