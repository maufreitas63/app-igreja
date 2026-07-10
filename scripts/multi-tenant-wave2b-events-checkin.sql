-- =============================================================================
-- Multi-tenancy — onda 2b: eventos / check-in / avisos (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   register-member-atomic.sql / register-profile-atomic.sql / room-servidor-checkin-rpc.sql
--   checkins-totem-flow.sql / geo-checkin-automatic.sql
--   replicate-event-structure.sql / access-control-tesoureiro-role.sql
--   event-control-orchestration.sql / event-avisos-schema.sql
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- get_event_registration_count
-- ---------------------------------------------------------------------------
create or replace function public.get_event_registration_count(
  p_event_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return (
  select count(*)
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
  );
end;
$$;

grant execute on function public.get_event_registration_count(uuid) to anon;
grant execute on function public.get_event_registration_count(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- get_event_registrations_by_status
-- ---------------------------------------------------------------------------
create or replace function public.get_event_registrations_by_status(
  p_event_id uuid
)
returns table (
  registration_id uuid,
  full_name text,
  kids_status text,
  room_entry_checked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    er.id,
    er.full_name,
    er.kids_status,
    er.room_entry_checked
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
    and er.kids_status in ('KIDS', 'TEENS')
  order by er.kids_status asc, er.full_name asc;
end;
$$;

grant execute on function public.get_event_registrations_by_status(uuid) to anon;
grant execute on function public.get_event_registrations_by_status(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- get_registered_event_members
-- ---------------------------------------------------------------------------
create or replace function public.get_registered_event_members(
  p_event_id uuid,
  p_family_id text
)
returns table (
  profile_id uuid,
  family_id text,
  full_name text,
  kids_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    er.profile_id,
    er.family_id,
    er.full_name,
    er.kids_status
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
    and er.family_id = p_family_id
  order by er.created_at desc;
end;
$$;

grant execute on function public.get_registered_event_members(uuid, text) to anon;
grant execute on function public.get_registered_event_members(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- sync_family_event_registrations_atomic
-- ---------------------------------------------------------------------------
create or replace function public.sync_family_event_registrations_atomic(
  p_event_id uuid,
  p_family_group_id text,
  p_member_ids uuid[],
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
  v_tenant uuid := public.require_session_tenant_id();
  v_member_id uuid;
  v_result jsonb;
  v_names text[] := '{}';
  v_name text;
  v_target_profile_ids uuid[] := '{}';
  v_profile_id uuid;
  v_member members%rowtype;
  v_has_existing_checkin boolean;
begin
  perform public.assert_session_can_manage_family(p_family_group_id);

  v_has_existing_checkin := public.family_has_geo_checkin_at_event(p_event_id, p_family_group_id);

  perform public.assert_geofence_for_event(
    p_event_id,
    p_latitude,
    p_longitude,
    coalesce(p_skip_geofence, false) or v_has_existing_checkin
  );

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
  loop
    select m.*
      into v_member
    from public.members m
    where m.tenant_id = v_tenant
    and  m.id = v_member_id
      and m.accepted is true;

    if not found then
      raise exception 'Membro % não encontrado ou não reconhecido.', v_member_id::text;
    end if;

    if v_member.family_id is not null
       and trim(v_member.family_id) <> trim(p_family_group_id) then
      raise exception 'Membro % não pertence à família informada.', v_member_id::text;
    end if;

    v_profile_id := public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name);

    if v_profile_id is null then
      raise exception 'Perfil vinculado ao membro % não foi encontrado.', v_member_id::text;
    end if;

    v_target_profile_ids := array_append(v_target_profile_ids, v_profile_id);
  end loop;

  delete from public.event_registrations er
  where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
    and er.family_id = trim(p_family_group_id)
    and (
      cardinality(v_target_profile_ids) = 0
      or er.profile_id <> all (v_target_profile_ids)
    );

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
  loop
    v_result := public.register_member_atomic(p_event_id, v_member_id, p_family_group_id);

    if coalesce((v_result ->> 'success')::boolean, false) is not true then
      raise exception '%', coalesce(v_result ->> 'message', 'Falha ao registrar participante.');
    end if;

    select m.full_name
      into v_name
    from public.members m
    where m.id = v_member_id;

    if v_name is not null then
      v_names := array_append(v_names, trim(v_name));
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Audiência da família atualizada com sucesso.',
    'participant_names', to_jsonb(v_names)
  );
end;
$$;

grant execute on function public.sync_family_event_registrations_atomic(uuid, text, uuid[], double precision, double precision, boolean) to anon;
grant execute on function public.sync_family_event_registrations_atomic(uuid, text, uuid[], double precision, double precision, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- register_profile_atomic
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
     where e.tenant_id = v_tenant
    and  e.id = p_event_id
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
   where p.tenant_id = v_tenant
    and  p.id = p_profile_id;

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
  where ap.tenant_id = v_tenant
    and  lower(ap.parameter) = 'idade_kids'
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
   where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
     and er.profile_id = v_profile.id
   limit 1;

  if v_existing_registration_id is not null then
    update public.event_registrations
       set family_id = v_resolved_family_id,
           full_name = v_profile.full_name,
           kids_status = v_kids_status
     where tenant_id = v_tenant
     and id = v_existing_registration_id;

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
    kids_status, tenant_id)
  values (
    p_event_id,
    v_profile.id,
    v_resolved_family_id,
    v_profile.full_name,
    v_kids_status,
    v_tenant)
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

grant execute on function public.register_profile_atomic(uuid, uuid) to anon;
grant execute on function public.register_profile_atomic(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- unregister_profile_atomic
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
   where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
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

grant execute on function public.unregister_profile_atomic(uuid, uuid) to anon;
grant execute on function public.unregister_profile_atomic(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- set_event_registration_room_entry (2 args)
-- ---------------------------------------------------------------------------
create or replace function public.set_event_registration_room_entry(
  p_registration_id uuid,
  p_room_entry_checked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  update public.event_registrations
  set room_entry_checked = coalesce(p_room_entry_checked, false)
  where tenant_id = v_tenant
     and id = p_registration_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Inscrição do evento não encontrada.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Entrada na sala atualizada com sucesso.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.set_event_registration_room_entry(uuid, boolean) to anon;
grant execute on function public.set_event_registration_room_entry(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- set_event_registration_room_entry (3 args)
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_event_date timestamptz;
  v_service_date date;
  v_kids_status text;
begin
  select er.kids_status, ev.event_date
    into v_kids_status, v_event_date
    from public.event_registrations er
    join public.events ev on ev.id = er.event_id
   where ev.tenant_id = v_tenant
    and  er.tenant_id = v_tenant
    and  er.id = p_registration_id;

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
      'Somente servidores escalados para esta sala na data do evento podem registrar o check-in.'
    );
  end if;

  update public.event_registrations
     set room_entry_checked = coalesce(p_room_entry_checked, false)
   where tenant_id = v_tenant
     and id = p_registration_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Inscrição do evento não encontrada.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Entrada na sala atualizada com sucesso.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.set_event_registration_room_entry(uuid, boolean, uuid) to anon;
grant execute on function public.set_event_registration_room_entry(uuid, boolean, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- confirm_totem_checkin
-- ---------------------------------------------------------------------------
create or replace function public.confirm_totem_checkin(
  p_event_id uuid,
  p_family_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_lookup jsonb;
  v_updated integer;
  v_row record;
begin
  v_lookup := public.lookup_totem_checkin(p_event_id, p_family_id);

  if coalesce((v_lookup ->> 'success')::boolean, false) is not true then
    return v_lookup;
  end if;

  if coalesce((v_lookup ->> 'already_confirmed')::boolean, false) then
    return jsonb_build_object(
      'success', false,
      'code', 'ALREADY_CONFIRMED',
      'message', 'Check-in já confirmado para esta família.'
    );
  end if;

  if coalesce((v_lookup ->> 'can_confirm')::boolean, false) is not true then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Nenhum pré-check-in encontrado para esta família neste evento.'
    );
  end if;

  update public.checkins c
  set
    status = 'confirmado',
    timestamp_confirmacao = now()
  where c.tenant_id = v_tenant
    and  c.event_id = p_event_id
    and upper(trim(c.family_id)) = upper(trim(p_family_id))
    and c.status = 'pre_checkin';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Nenhum pré-check-in pendente para confirmar.'
    );
  end if;

  for v_row in
    select c.event_registration_id, c.profile_id
    from public.checkins c
    where c.event_id = p_event_id
      and upper(trim(c.family_id)) = upper(trim(p_family_id))
      and c.status = 'confirmado'
  loop
    perform public.maybe_sync_quorum_registry_for_registration(
      p_event_id,
      v_row.event_registration_id,
      v_row.profile_id
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'code', 'CONFIRMED',
    'message', 'Confirmação realizada com sucesso',
    'updated_count', v_updated
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.confirm_totem_checkin(uuid, text) to anon;
grant execute on function public.confirm_totem_checkin(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- confirm_geo_family_checkin_atomic
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
    where er.tenant_id = v_tenant
    and  er.event_id = p_event_id
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
    where c.tenant_id = v_tenant
    and  c.event_registration_id = v_reg.registration_id
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
        geo_confirmed_at, tenant_id)
      values (
        p_event_id,
        v_reg.registration_id,
        trim(p_family_group_id),
        v_reg.profile_id,
        'confirmado',
        now(),
        p_latitude,
        p_longitude,
        now(),
    v_tenant)
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

grant execute on function public.confirm_geo_family_checkin_atomic(uuid, text, double precision, double precision, boolean) to anon;
grant execute on function public.confirm_geo_family_checkin_atomic(uuid, text, double precision, double precision, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- lookup_totem_checkin
-- ---------------------------------------------------------------------------
create or replace function public.lookup_totem_checkin(
  p_event_id uuid,
  p_family_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_totem_ativo boolean;
  v_requer_quorum boolean;
  v_pre_count integer;
  v_confirmed_count integer;
  v_family text;
begin
  v_family := upper(nullif(trim(coalesce(p_family_id, '')), ''));

  if v_family is null then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Código da família inválido.'
    );
  end if;

  select coalesce(e.totem_ativo, false), coalesce(e.requer_quorum, false)
    into v_totem_ativo, v_requer_quorum
  from public.events e
  where e.tenant_id = v_tenant
    and  e.id = p_event_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'EVENT_NOT_FOUND',
      'message', 'Evento não encontrado.'
    );
  end if;

  if not coalesce(v_totem_ativo, false) and not coalesce(v_requer_quorum, false) then
    return jsonb_build_object(
      'success', false,
      'code', 'TOTEM_INACTIVE',
      'message', 'Totem não está ativo para este evento.'
    );
  end if;

  select
    count(*) filter (where c.status = 'pre_checkin'),
    count(*) filter (where c.status = 'confirmado')
  into v_pre_count, v_confirmed_count
  from public.checkins c
  where c.tenant_id = v_tenant
    and  c.event_id = p_event_id
    and upper(trim(c.family_id)) = v_family;

  return jsonb_build_object(
    'success', true,
    'pre_checkin_count', coalesce(v_pre_count, 0),
    'confirmed_count', coalesce(v_confirmed_count, 0),
    'can_confirm', coalesce(v_pre_count, 0) > 0,
    'already_confirmed', coalesce(v_pre_count, 0) = 0 and coalesce(v_confirmed_count, 0) > 0
  );
end;
$$;

grant execute on function public.lookup_totem_checkin(uuid, text) to anon;
grant execute on function public.lookup_totem_checkin(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- replicate_maintenance_event_atomic
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_source public.events%rowtype;
  v_new_id uuid;
  v_offset integer;
begin
  v_offset := greatest(coalesce(p_day_offset, 7), 1);

  select *
    into v_source
    from public.events
   where tenant_id = v_tenant
    and id = p_source_event_id;

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
    is_locked, tenant_id)
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
    true,
    v_tenant)
  returning id into v_new_id;

  return jsonb_build_object(
    'success', true,
    'new_event_id', v_new_id,
    'registrations_copied', 0
  );
end;
$$;

grant execute on function public.replicate_maintenance_event_atomic(uuid, integer) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- lock_past_events
-- ---------------------------------------------------------------------------
create or replace function public.lock_past_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_count integer;
  v_today date := public.app_local_today();
begin
  update public.events e
     set is_locked = true
   where e.tenant_id = v_tenant
    and  coalesce(e.retroactive_publish, false) is not true
     and e.event_date is not null
     and (
       case pg_typeof(e.event_date)::text
         when 'date' then e.event_date::date < v_today
         when 'timestamp without time zone' then e.event_date::date < v_today
         when 'timestamp with time zone' then
           (e.event_date::timestamptz at time zone 'America/Sao_Paulo')::date < v_today
         else
           public.is_event_date_in_past(e.event_date::text)
       end
     )
     and coalesce(e.is_locked, false) is distinct from true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.lock_past_events() to anon;
grant execute on function public.lock_past_events() to authenticated;


-- ---------------------------------------------------------------------------
-- atualizar_event_control_rota
-- ---------------------------------------------------------------------------
create or replace function public.atualizar_event_control_rota(
  p_actor_profile_id uuid,
  p_active_route text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_route text;
  v_row public.event_control%rowtype;
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Apenas orquestradores de evento podem alterar a orquestração.'
    );
  end if;

  v_route := lower(trim(coalesce(p_active_route, '')));

  if v_route in ('/ofertas', '/dizimos') then
    v_route := '/ofertas_dizimos';
  end if;

  if v_route not in ('/home', '/ofertas_dizimos', '/avisos', '/ofertas', '/dizimos') then
    return jsonb_build_object('success', false, 'message', 'Rota inválida para orquestração.');
  end if;

  update public.event_control
     set active_route = v_route,
         updated_at = now()
   where tenant_id = v_tenant
     and id = 1
  returning * into v_row;

  if not found then
    insert into public.event_control (id, active_route, updated_at, tenant_id)
    values (1, v_route, now(),
    v_tenant)
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'success',
    true,
    'message',
    'Rota atualizada.',
    'id',
    v_row.id,
    'active_route',
    v_row.active_route,
    'updated_at',
    v_row.updated_at
  );
end;
$$;

grant execute on function public.atualizar_event_control_rota(uuid, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- listar_event_avisos_orquestrador
-- ---------------------------------------------------------------------------
create or replace function public.listar_event_avisos_orquestrador(p_actor_profile_id uuid)
returns setof public.event_avisos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select *
    from public.event_avisos ea
   where ea.tenant_id = v_tenant
    and  public.profile_is_event_control_admin(p_actor_profile_id)
   order by ea.sort_order asc, ea.updated_at desc;
end;
$$;

grant execute on function public.listar_event_avisos_orquestrador(uuid) to anon;
grant execute on function public.listar_event_avisos_orquestrador(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- listar_event_avisos_publicados
-- ---------------------------------------------------------------------------
create or replace function public.listar_event_avisos_publicados()
returns setof public.event_avisos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select *
    from public.event_avisos ea
   where ea.tenant_id = v_tenant
    and  ea.is_published is true
   order by ea.sort_order asc, ea.updated_at desc;
end;
$$;

grant execute on function public.listar_event_avisos_publicados() to anon;
grant execute on function public.listar_event_avisos_publicados() to authenticated;


-- ---------------------------------------------------------------------------
-- salvar_event_aviso
-- ---------------------------------------------------------------------------
create or replace function public.salvar_event_aviso(
  p_actor_profile_id uuid,
  p_id uuid default null,
  p_title text default '',
  p_body text default '',
  p_sort_order integer default 0,
  p_is_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_id uuid;
  v_row public.event_avisos%rowtype;
  v_title text;
  v_body text;
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerenciar avisos.');
  end if;

  v_title := trim(coalesce(p_title, ''));
  v_body := trim(coalesce(p_body, ''));

  if v_body = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o texto do aviso.');
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  insert into public.event_avisos (
    id,
    title,
    body,
    sort_order,
    is_published,
    created_by_profile_id,
    updated_by_profile_id, tenant_id)
  values (
    v_id,
    v_title,
    v_body,
    coalesce(p_sort_order, 0),
    coalesce(p_is_published, true),
    p_actor_profile_id,
    p_actor_profile_id,
    v_tenant)
  on conflict (id) do update
    set title = excluded.title,
        body = excluded.body,
        sort_order = excluded.sort_order,
        is_published = excluded.is_published,
        updated_at = now(),
        updated_by_profile_id = p_actor_profile_id
  returning * into v_row;

  return jsonb_build_object(
    'success',
    true,
    'message',
    'Aviso salvo.',
    'id',
    v_row.id,
    'title',
    v_row.title,
    'body',
    v_row.body,
    'sort_order',
    v_row.sort_order,
    'is_published',
    v_row.is_published,
    'updated_at',
    v_row.updated_at
  );
end;
$$;

grant execute on function public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean) to anon;
grant execute on function public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- excluir_event_aviso
-- ---------------------------------------------------------------------------
create or replace function public.excluir_event_aviso(
  p_actor_profile_id uuid,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir avisos.');
  end if;

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Aviso inválido.');
  end if;

  delete from public.event_avisos where tenant_id = v_tenant
     and id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Aviso não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Aviso excluído.');
end;
$$;

grant execute on function public.excluir_event_aviso(uuid, uuid) to anon;
grant execute on function public.excluir_event_aviso(uuid, uuid) to authenticated;


notify pgrst, 'reload schema';

commit;
