-- =============================================================================
-- Excluir horário pastoral ainda disponível (não reservado)
-- Aplica: npx supabase db query --linked -f scripts/pastoral-slot-delete.sql
-- =============================================================================

create or replace function public.delete_pastoral_slot(p_slot_id uuid)
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
begin
  if v_actor is null or not public.session_has_pastoral_agenda_access() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir horários.');
  end if;

  if not public.profile_is_pastoral_attendant(v_actor)
     and not public.is_super_admin_profile(v_actor)
  then
    return jsonb_build_object('success', false, 'message', 'Apenas a equipe pastoral exclui horários.');
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

  if not public.is_super_admin_profile(v_actor) and v_slot.pastor_id <> v_actor then
    return jsonb_build_object('success', false, 'message', 'Só é possível excluir os próprios horários.');
  end if;

  if v_slot.status <> 'disponivel' then
    return jsonb_build_object(
      'success', false,
      'message', 'Só é possível excluir horários ainda disponíveis. Cancelar reserva exige outro fluxo.'
    );
  end if;

  delete from public.pastoral_slots
   where id = v_slot.id
     and tenant_id = v_tenant
     and status = 'disponivel';

  if not found then
    return jsonb_build_object('success', false, 'message', 'Não foi possível excluir este horário.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Horário excluído.');
end;
$$;

revoke all on function public.delete_pastoral_slot(uuid) from public;
grant execute on function public.delete_pastoral_slot(uuid) to anon, authenticated, service_role;
