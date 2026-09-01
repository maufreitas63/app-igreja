-- Check-in por aproximação: presença só confirma com GPS no raio.
-- 1) family_has_geo_checkin_at_event = geo_confirmed_at (não pré-check-in).
-- 2) Evento com geofence_ativo: audiência gera pré-check-in, não confirmado.
-- 3) Eventos futuros já confirmados sem GPS voltam a pré-check-in.

begin;

create or replace function public.family_has_geo_checkin_at_event(
  p_event_id uuid,
  p_family_group_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.checkins c
    join public.event_registrations er on er.id = c.event_registration_id
    where er.tenant_id = public.require_session_tenant_id()
      and c.tenant_id = er.tenant_id
      and er.event_id = p_event_id
      and er.family_id = trim(p_family_group_id)
      and c.geo_confirmed_at is not null
  );
$$;

comment on function public.family_has_geo_checkin_at_event(uuid, text) is
  'Verdadeiro somente se a família já confirmou presença por geofence (geo_confirmed_at).';

grant execute on function public.family_has_geo_checkin_at_event(uuid, text) to anon, authenticated;

create or replace function public.sync_checkin_for_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_family_id text,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_totem_ativo boolean;
  v_requer_quorum boolean;
  v_geofence_ativo boolean;
  v_check_in_automatico text;
  v_status text;
begin
  if p_registration_id is null or p_profile_id is null then
    return;
  end if;

  select
    coalesce(e.totem_ativo, false),
    coalesce(e.requer_quorum, false),
    coalesce(e.geofence_ativo, false)
    into v_totem_ativo, v_requer_quorum, v_geofence_ativo
  from public.events e
  where e.tenant_id = v_tenant
    and e.id = p_event_id;

  if not found then
    return;
  end if;

  if coalesce(v_totem_ativo, false)
     or coalesce(v_requer_quorum, false)
     or coalesce(v_geofence_ativo, false) then
    v_status := 'pre_checkin';
  else
    select ap.value
      into v_check_in_automatico
    from public.app_parameters ap
    where ap.tenant_id = v_tenant
      and lower(ap.parameter) = 'check_in_automatico'
    limit 1;

    if lower(trim(coalesce(v_check_in_automatico, ''))) = 'nao' then
      perform public.maybe_sync_quorum_registry_for_registration(
        p_event_id,
        p_registration_id,
        p_profile_id
      );
      return;
    end if;

    v_status := 'confirmado';
  end if;

  insert into public.checkins (
    event_id,
    event_registration_id,
    family_id,
    profile_id,
    status,
    timestamp_confirmacao,
    tenant_id
  )
  values (
    p_event_id,
    p_registration_id,
    upper(trim(coalesce(nullif(trim(p_family_id), ''), '—'))),
    p_profile_id,
    v_status,
    case when v_status = 'confirmado' then now() else null end,
    v_tenant
  )
  on conflict (event_registration_id) do update
  set
    family_id = excluded.family_id,
    profile_id = excluded.profile_id,
    status = case
      when public.checkins.status = 'confirmado' then 'confirmado'
      else excluded.status
    end,
    timestamp_confirmacao = case
      when excluded.status = 'confirmado' then coalesce(public.checkins.timestamp_confirmacao, now())
      else public.checkins.timestamp_confirmacao
    end,
    tenant_id = coalesce(public.checkins.tenant_id, excluded.tenant_id);

  perform public.maybe_sync_quorum_registry_for_registration(
    p_event_id,
    p_registration_id,
    p_profile_id
  );
end;
$$;

grant execute on function public.sync_checkin_for_registration(uuid, uuid, text, uuid) to anon;
grant execute on function public.sync_checkin_for_registration(uuid, uuid, text, uuid) to authenticated;

-- Eventos ainda não ocorridos: presença automática sem GPS não vale como check-in geo.
update public.checkins c
set
  status = 'pre_checkin',
  timestamp_confirmacao = null
from public.events e
where e.id = c.event_id
  and e.tenant_id = c.tenant_id
  and coalesce(e.geofence_ativo, false) = true
  and coalesce(e.totem_ativo, false) is not true
  and coalesce(e.requer_quorum, false) is not true
  and e.event_date >= now()
  and c.status = 'confirmado'
  and c.geo_confirmed_at is null;

notify pgrst, 'reload schema';

commit;
