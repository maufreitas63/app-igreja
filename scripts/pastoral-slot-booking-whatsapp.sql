-- Ao reservar horário pastoral, devolver telefone de quem abriu a agenda
-- para o app avisar no WhatsApp.

create or replace function public.list_available_pastoral_slots(
  p_pastor_id uuid default null,
  p_from timestamptz default now(),
  p_until timestamptz default now() + interval '45 days'
)
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
  if v_actor is null or not public.session_can_book_pastoral_slot() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'slots', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'slots',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'pastor_id', s.pastor_id,
            'pastor_name', p.full_name,
            'pastor_phone', p.phone,
            'data_hora_inicio', s.data_hora_inicio,
            'data_hora_fim', s.data_hora_fim,
            'tipo_atendimento', s.tipo_atendimento,
            'status', s.status
          )
          order by s.data_hora_inicio
        )
        from public.pastoral_slots s
        join public.profiles p on p.id = s.pastor_id
       where s.tenant_id = v_tenant
         and s.status = 'disponivel'
         and s.is_published is true
         and s.data_hora_inicio >= coalesce(p_from, now())
         and s.data_hora_inicio < coalesce(p_until, now() + interval '45 days')
         and (p_pastor_id is null or s.pastor_id = p_pastor_id)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.book_pastoral_slot(
  p_slot_id uuid,
  p_request_id uuid default null
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
  v_request public.pastoral_requests%rowtype;
  v_pastor_name text;
  v_pastor_phone text;
begin
  if v_actor is null or not public.session_can_book_pastoral_slot() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para agendar.');
  end if;

  select * into v_slot
    from public.pastoral_slots s
   where s.id = p_slot_id
     and s.tenant_id = v_tenant
   for update;

  if v_slot.id is null then
    return jsonb_build_object('success', false, 'message', 'Horário não encontrado.');
  end if;

  if v_slot.status <> 'disponivel' or v_slot.is_published is not true then
    return jsonb_build_object('success', false, 'message', 'Este horário não está mais disponível.');
  end if;

  if v_slot.data_hora_inicio <= now() then
    return jsonb_build_object('success', false, 'message', 'Não é possível reservar um horário já iniciado.');
  end if;

  if p_request_id is not null then
    select * into v_request
      from public.pastoral_requests pr
     where pr.id = p_request_id
       and pr.profile_id = v_actor
       and coalesce(pr.tenant_id, v_tenant) = v_tenant;

    if v_request.id is null then
      return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
    end if;
  end if;

  update public.pastoral_slots
     set status = 'reservado',
         member_profile_id = v_actor,
         pastoral_request_id = case when p_request_id is not null then v_request.id else null end,
         updated_at = now()
   where id = v_slot.id
     and status = 'disponivel';

  if not found then
    return jsonb_build_object('success', false, 'message', 'Não foi possível reservar este horário.');
  end if;

  select p.full_name, p.phone
    into v_pastor_name, v_pastor_phone
    from public.profiles p
   where p.id = v_slot.pastor_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Atendimento agendado.',
    'pastor_name', coalesce(v_pastor_name, 'Atendente'),
    'pastor_phone', v_pastor_phone,
    'data_hora_inicio', v_slot.data_hora_inicio,
    'data_hora_fim', v_slot.data_hora_fim,
    'tipo_atendimento', v_slot.tipo_atendimento
  );
end;
$$;

notify pgrst, 'reload schema';

grant execute on function public.list_available_pastoral_slots(uuid, timestamptz, timestamptz)
  to anon, authenticated;
grant execute on function public.book_pastoral_slot(uuid, uuid) to anon, authenticated;

