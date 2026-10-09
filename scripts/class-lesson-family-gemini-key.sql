-- A conversa em família usa a chave da Abigail sem exigir o papel de liderança.
-- Quem pode planejar a sala (get_class_lesson) lê a chave. A tabela fica fechada no anon.

create or replace function public.obter_chave_gemini_planejamento_aula(
  p_event_id uuid,
  p_room_key text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_room text := upper(trim(coalesce(p_room_key, '')));
  v_date date;
  v_key text;
begin
  if v_me is null or v_tenant is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  if v_room not in ('KIDS', 'TEENS') then
    raise exception 'Sala inválida.';
  end if;

  select public.event_local_date(e.event_date)
    into v_date
    from public.events e
   where e.id = p_event_id
     and e.tenant_id = v_tenant;

  if v_date is null then
    raise exception 'Evento não encontrado nesta instância.';
  end if;

  if not public.profile_can_record_room_attendance(v_me, v_room, v_date) then
    raise exception 'Sem permissão para o planejamento desta sala.';
  end if;

  select c.config_value
    into v_key
    from public.ai_server_config c
   where c.config_key = 'gemini_api_key';

  if nullif(trim(coalesce(v_key, '')), '') is null then
    raise exception 'Chave Gemini não configurada. O Super Administrador cadastra a chave em Chave Gemini.';
  end if;

  return trim(v_key);
end;
$$;

grant execute on function public.obter_chave_gemini_planejamento_aula(uuid, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
