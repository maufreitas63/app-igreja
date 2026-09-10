-- =============================================================================
-- Lista de presença: gravar também eventos com Totem (não só Requer Quórum)
-- =============================================================================
-- Na prática os cultos usam totem_ativo. A lista de presença só lia
-- requer_quorum, então ficava vazia. A sincronização passa a incluir os dois.
-- =============================================================================

begin;

create or replace function public.sync_quorum_registry_for_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracks_presence boolean;
  v_event public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_checkin public.checkins%rowtype;
  v_status text;
  v_registered_at timestamptz;
begin
  if p_event_id is null or p_profile_id is null then
    return;
  end if;

  select coalesce(e.totem_ativo, false) or coalesce(e.requer_quorum, false)
    into v_tracks_presence
  from public.events e
  where e.id = p_event_id;

  if not coalesce(v_tracks_presence, false) then
    return;
  end if;

  select *
    into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    return;
  end if;

  select *
    into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return;
  end if;

  if p_registration_id is not null then
    select *
      into v_checkin
    from public.checkins c
    where c.event_registration_id = p_registration_id
    limit 1;
  end if;

  if v_checkin.id is not null then
    v_status := coalesce(nullif(trim(v_checkin.status), ''), 'pre_checkin');
    v_registered_at := coalesce(v_checkin.created_at, now());
  else
    v_status := 'inscrito';
    v_registered_at := now();
  end if;

  insert into public.event_quorum_registry (
    event_id,
    event_registration_id,
    profile_id,
    checkin_id,
    event_name,
    event_date,
    event_local,
    max_capacity,
    participant_name,
    participant_phone,
    participant_email,
    participant_cpf,
    checkin_status,
    registered_at,
    confirmed_at,
    updated_at
  )
  values (
    p_event_id,
    p_registration_id,
    p_profile_id,
    v_checkin.id,
    coalesce(nullif(trim(v_event.name), ''), 'Evento'),
    v_event.event_date::date,
    nullif(trim(coalesce(v_event.event_local, '')), ''),
    v_event.max_capacity,
    nullif(trim(coalesce(v_profile.full_name, '')), ''),
    nullif(trim(coalesce(v_profile.phone, '')), ''),
    nullif(trim(coalesce(v_profile.email, '')), ''),
    nullif(trim(coalesce(v_profile.cpf, '')), ''),
    v_status,
    v_registered_at,
    v_checkin.timestamp_confirmacao,
    now()
  )
  on conflict (event_id, profile_id) do update
  set
    event_registration_id = coalesce(excluded.event_registration_id, public.event_quorum_registry.event_registration_id),
    checkin_id = coalesce(excluded.checkin_id, public.event_quorum_registry.checkin_id),
    event_name = excluded.event_name,
    event_date = excluded.event_date,
    event_local = excluded.event_local,
    max_capacity = excluded.max_capacity,
    participant_name = excluded.participant_name,
    participant_phone = excluded.participant_phone,
    participant_email = excluded.participant_email,
    participant_cpf = excluded.participant_cpf,
    checkin_status = excluded.checkin_status,
    confirmed_at = excluded.confirmed_at,
    updated_at = now(),
    registered_at = case
      when public.event_quorum_registry.checkin_id is null
        and excluded.checkin_id is not null
        then excluded.registered_at
      else public.event_quorum_registry.registered_at
    end;
end;
$$;

create or replace function public.backfill_event_quorum_registry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select er.event_id, er.id as registration_id, er.profile_id
    from public.event_registrations er
    inner join public.events e on e.id = er.event_id
    where (
        coalesce(e.totem_ativo, false) = true
        or coalesce(e.requer_quorum, false) = true
      )
      and er.profile_id is not null
  loop
    perform public.sync_quorum_registry_for_registration(
      v_row.event_id,
      v_row.registration_id,
      v_row.profile_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.sync_quorum_registry_for_registration(uuid, uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function public.backfill_event_quorum_registry()
  to anon, authenticated, service_role;

select public.backfill_event_quorum_registry() as backfilled_rows;

commit;
