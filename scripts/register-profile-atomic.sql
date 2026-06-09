-- Inscrição individual em eventos pelo perfil da sessão (sem linha em public.members).
-- Execute no SQL Editor do Supabase após register-member-atomic.sql e checkins-totem-flow.sql.

create or replace function public.register_profile_atomic(
  p_event_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_session_profile_id uuid;
  v_existing_registration_id uuid;
  v_registration_id uuid;
  v_age_years integer;
  v_idade_kids integer;
  v_idade_teens integer;
  v_kids_status text;
  v_resolved_family_id text;
begin
  if p_event_id is null then
    return jsonb_build_object('success', false, 'message', 'Evento não informado.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if exists (
    select 1
      from public.events e
     where e.id = p_event_id
       and coalesce(e.requer_quorum, false)
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Somente membros cadastrados na família podem se inscrever em eventos com quórum.'
    );
  end if;

  v_session_profile_id := public.current_session_profile_id();

  if v_session_profile_id is not null and v_session_profile_id <> p_profile_id then
    return jsonb_build_object(
      'success', false,
      'message', 'Sessão não corresponde ao perfil informado.'
    );
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where p.id = p_profile_id;

  if v_profile.id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if nullif(trim(coalesce(v_profile.full_name, '')), '') is null then
    return jsonb_build_object('success', false, 'message', 'Perfil sem nome para inscrição.');
  end if;

  v_resolved_family_id := nullif(
    trim(coalesce(v_profile.family_id, v_profile.codigo_membro, '')),
    ''
  );

  select
    case when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer else null end
    into v_idade_kids
  from public.app_parameters ap
  where lower(ap.parameter) = 'idade_kids'
  limit 1;

  select
    case when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer else null end
    into v_idade_teens
  from public.app_parameters ap
  where lower(ap.parameter) = 'idade_teens'
  limit 1;

  if v_profile.birth_date is not null then
    v_age_years := extract(year from age(current_date, v_profile.birth_date::date))::integer;

    if v_idade_kids is not null and v_age_years <= v_idade_kids then
      v_kids_status := 'KIDS';
    elsif
      v_idade_kids is not null
      and v_idade_teens is not null
      and v_age_years > v_idade_kids
      and v_age_years <= v_idade_teens
    then
      v_kids_status := 'TEENS';
    end if;
  end if;

  select er.id
    into v_existing_registration_id
    from public.event_registrations er
   where er.event_id = p_event_id
     and er.profile_id = v_profile.id
   limit 1;

  if v_existing_registration_id is not null then
    update public.event_registrations
       set family_id = v_resolved_family_id,
           full_name = v_profile.full_name,
           kids_status = v_kids_status
     where id = v_existing_registration_id;

    perform public.sync_checkin_for_registration(
      p_event_id,
      v_existing_registration_id,
      v_resolved_family_id,
      v_profile.id
    );

    return jsonb_build_object(
      'success', true,
      'message', 'Participante já estava registrado.'
    );
  end if;

  insert into public.event_registrations (
    event_id,
    profile_id,
    family_id,
    full_name,
    kids_status
  )
  values (
    p_event_id,
    v_profile.id,
    v_resolved_family_id,
    v_profile.full_name,
    v_kids_status
  )
  returning id into v_registration_id;

  perform public.sync_checkin_for_registration(
    p_event_id,
    v_registration_id,
    v_resolved_family_id,
    v_profile.id
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Participante registrado com sucesso.'
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

create or replace function public.unregister_profile_atomic(
  p_event_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_profile_id uuid;
  v_deleted_count integer;
begin
  if p_event_id is null then
    return jsonb_build_object('success', false, 'message', 'Evento não informado.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  v_session_profile_id := public.current_session_profile_id();

  if v_session_profile_id is not null and v_session_profile_id <> p_profile_id then
    return jsonb_build_object(
      'success', false,
      'message', 'Sessão não corresponde ao perfil informado.'
    );
  end if;

  delete from public.event_registrations er
   where er.event_id = p_event_id
     and er.profile_id = p_profile_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    return jsonb_build_object(
      'success', true,
      'message', 'Participante já não estava registrado.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Participante removido do evento com sucesso.'
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.register_profile_atomic(uuid, uuid) to anon, authenticated;
grant execute on function public.unregister_profile_atomic(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
