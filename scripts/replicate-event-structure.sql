-- Replica apenas a estrutura do evento (+N dias, rascunho). Não copia inscrições.
-- Execute no Supabase para garantir duplicação sem event_registrations.

create or replace function public.replicate_maintenance_event_atomic(
  p_source_event_id uuid,
  p_day_offset integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.events%rowtype;
  v_new_id uuid;
  v_offset integer;
begin
  v_offset := greatest(coalesce(p_day_offset, 7), 1);

  select *
    into v_source
    from public.events
   where id = p_source_event_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Evento de origem não encontrado.'
    );
  end if;

  insert into public.events (
    name,
    event_date,
    event_local,
    max_capacity,
    kids_room,
    teens_room,
    parm_ofertas,
    totem_ativo,
    requer_quorum,
    somente_membros,
    geofence_ativo,
    is_locked
  )
  values (
    v_source.name,
    v_source.event_date + make_interval(days => v_offset),
    v_source.event_local,
    v_source.max_capacity,
    v_source.kids_room,
    v_source.teens_room,
    v_source.parm_ofertas,
    coalesce(v_source.totem_ativo, false),
    coalesce(v_source.requer_quorum, false),
    coalesce(v_source.somente_membros, false),
    coalesce(v_source.geofence_ativo, false),
    true
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'success', true,
    'new_event_id', v_new_id,
    'registrations_copied', 0
  );
end;
$$;

grant execute on function public.replicate_maintenance_event_atomic(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
