-- =============================================================================
-- Cancelar reserva de horário pastoral (membro) com justificativa.
-- O horário volta a ficar disponível. O app avisa o atendente no WhatsApp.
-- Aplica: npx supabase db query --linked -f scripts/pastoral-slot-cancel.sql
-- =============================================================================

alter table public.pastoral_slots
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_profile_id uuid references public.profiles (id) on delete set null;

create or replace function public.list_my_pastoral_appointments()
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
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'appointments', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'appointments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'pastoral_request_id', s.pastoral_request_id,
            'data_hora_inicio', s.data_hora_inicio,
            'data_hora_fim', s.data_hora_fim,
            'tipo_atendimento', s.tipo_atendimento,
            'status', s.status,
            'pastor_name', p.full_name,
            'pastor_phone', p.phone,
            'request_status', pr.status,
            'destination_label', pr.destination_label,
            'can_cancel', s.status = 'reservado' and s.data_hora_inicio > now()
          )
          order by s.data_hora_inicio desc
        )
        from public.pastoral_slots s
        join public.profiles p on p.id = s.pastor_id
        left join public.pastoral_requests pr on pr.id = s.pastoral_request_id
       where s.tenant_id = v_tenant
         and s.member_profile_id = v_actor
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.cancel_pastoral_slot(
  p_slot_id uuid,
  p_reason text
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
  v_slot public.pastoral_slots%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_pastor_name text;
  v_pastor_phone text;
begin
  if v_actor is null or not public.session_can_book_pastoral_slot() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para cancelar.');
  end if;

  if char_length(v_reason) < 3 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe uma justificativa com pelo menos 3 caracteres.'
    );
  end if;

  if p_slot_id is null then
    return jsonb_build_object('success', false, 'message', 'Horário não informado.');
  end if;

  select * into v_slot
    from public.pastoral_slots s
   where s.id = p_slot_id
     and s.tenant_id = v_tenant
   for update;

  if v_slot.id is null then
    return jsonb_build_object('success', false, 'message', 'Horário não encontrado.');
  end if;

  if v_slot.member_profile_id is distinct from v_actor then
    return jsonb_build_object('success', false, 'message', 'Só é possível cancelar o próprio agendamento.');
  end if;

  if v_slot.status <> 'reservado' then
    return jsonb_build_object('success', false, 'message', 'Este horário já não está reservado.');
  end if;

  if v_slot.data_hora_inicio <= now() then
    return jsonb_build_object(
      'success', false,
      'message', 'Não é possível cancelar um horário já iniciado.'
    );
  end if;

  update public.pastoral_slots
     set status = 'disponivel',
         member_profile_id = null,
         pastoral_request_id = null,
         checkin_at = null,
         checkin_by_profile_id = null,
         member_reminded_at = null,
         pastor_reminded_at = null,
         cancel_reason = v_reason,
         cancelled_at = now(),
         cancelled_by_profile_id = v_actor,
         updated_at = now()
   where id = v_slot.id
     and status = 'reservado'
     and member_profile_id = v_actor;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Não foi possível cancelar este horário.');
  end if;

  select p.full_name, p.phone
    into v_pastor_name, v_pastor_phone
    from public.profiles p
   where p.id = v_slot.pastor_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Agendamento cancelado.',
    'pastor_name', coalesce(v_pastor_name, 'Atendente'),
    'pastor_phone', v_pastor_phone,
    'data_hora_inicio', v_slot.data_hora_inicio,
    'data_hora_fim', v_slot.data_hora_fim,
    'tipo_atendimento', v_slot.tipo_atendimento
  );
end;
$$;

revoke all on function public.list_my_pastoral_appointments() from public;
grant execute on function public.list_my_pastoral_appointments() to anon, authenticated, service_role;

revoke all on function public.cancel_pastoral_slot(uuid, text) from public;
grant execute on function public.cancel_pastoral_slot(uuid, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
