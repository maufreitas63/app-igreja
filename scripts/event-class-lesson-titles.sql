-- Títulos das aulas Infantil/Jovens do evento, visíveis na Agenda da Família.
-- A tabela class_lessons não aceita SELECT direto; get_class_lesson exige permissão de sala.

create or replace function public.list_event_class_lesson_titles(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not exists (
    select 1
      from public.events e
     where e.id = p_event_id
       and e.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Evento não encontrado nesta instância.');
  end if;

  return jsonb_build_object(
    'success', true,
    'titles', coalesce((
      select jsonb_agg(jsonb_build_object('room_key', cl.room_key, 'title', cl.title))
        from public.class_lessons cl
       where cl.tenant_id = v_tenant
         and cl.event_id = p_event_id
         and cl.room_key in ('KIDS', 'TEENS')
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.list_event_class_lesson_titles(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
