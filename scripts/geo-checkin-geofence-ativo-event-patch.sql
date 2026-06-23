-- Patch: geofence ativo por evento (não mais app_parameters).
-- Pré-requisito: scripts/events-geofence-ativo.sql
-- Execute no SQL Editor do Supabase se geo-checkin-automatic.sql já foi aplicado.

create or replace function public.assert_event_geofence_checkin_enabled(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  select coalesce(e.geofence_ativo, false)
    into v_enabled
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'Evento não encontrado.';
  end if;

  if not v_enabled then
    raise exception 'Check-in por proximidade não está habilitado para este evento.';
  end if;
end;
$$;

create or replace function public.confirm_geo_family_checkin_atomic(
  p_event_id uuid,
  p_family_group_id text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_skip_geofence boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg record;
  v_names text[] := '{}';
  v_has_existing_checkin boolean;
  v_updated_count integer := 0;
begin
  perform public.assert_session_can_manage_family(p_family_group_id);

  if not coalesce(p_skip_geofence, false) then
    perform public.assert_event_geofence_checkin_enabled(p_event_id);
  end if;

  v_has_existing_checkin := public.family_has_geo_checkin_at_event(p_event_id, p_family_group_id);

  perform public.assert_geofence_for_event(
    p_event_id,
    p_latitude,
    p_longitude,
    coalesce(p_skip_geofence, false) or v_has_existing_checkin
  );

  if not exists (
    select 1
    from public.event_registrations er
    where er.event_id = p_event_id
      and er.family_id = trim(p_family_group_id)
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum pré-cadastro encontrado para esta família neste evento.',
      'requires_precheckin', true
    );
  end if;

  for v_reg in
    select er.id as registration_id, er.profile_id, er.full_name
    from public.event_registrations er
    where er.event_id = p_event_id
      and er.family_id = trim(p_family_group_id)
    order by er.created_at
  loop
    perform public.sync_checkin_for_registration(
      p_event_id,
      v_reg.registration_id,
      trim(p_family_group_id),
      v_reg.profile_id
    );

    update public.checkins c
    set
      status = 'confirmado',
      timestamp_confirmacao = coalesce(c.timestamp_confirmacao, now()),
      geo_latitude = p_latitude,
      geo_longitude = p_longitude,
      geo_confirmed_at = now()
    where c.event_registration_id = v_reg.registration_id
      and c.event_id = p_event_id;

    get diagnostics v_updated_count = row_count;

    if v_updated_count = 0 then
      insert into public.checkins (
        event_id,
        event_registration_id,
        family_id,
        profile_id,
        status,
        timestamp_confirmacao,
        geo_latitude,
        geo_longitude,
        geo_confirmed_at
      )
      values (
        p_event_id,
        v_reg.registration_id,
        trim(p_family_group_id),
        v_reg.profile_id,
        'confirmado',
        now(),
        p_latitude,
        p_longitude,
        now()
      )
      on conflict (event_registration_id) do update
      set
        status = 'confirmado',
        timestamp_confirmacao = coalesce(checkins.timestamp_confirmacao, excluded.timestamp_confirmacao),
        geo_latitude = excluded.geo_latitude,
        geo_longitude = excluded.geo_longitude,
        geo_confirmed_at = excluded.geo_confirmed_at;
    end if;

    if v_reg.full_name is not null and trim(v_reg.full_name) <> '' then
      v_names := array_append(v_names, trim(v_reg.full_name));
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Check-in confirmado com sucesso.',
    'participant_names', to_jsonb(v_names)
  );
end;
$$;

notify pgrst, 'reload schema';
