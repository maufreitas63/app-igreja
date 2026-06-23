-- Invalida check-ins do evento quando há alteração em evento com check-in automático
-- ou quando coordenadas/nome de local favorito vinculado mudam.
-- Execute no SQL Editor do Supabase (idempotente).
--
-- Pré-requisitos: checkins-totem-flow.sql, events-geofence-ativo.sql, geo-checkin-automatic.sql
--
-- Contrato espelhado em lib/geofenceEventIntegrity.ts (geofenceEventHasCheckinRelevantChanges).
-- normalize_location_key espelha lib/locationKey.ts.

-- ---------------------------------------------------------------------------
-- 1. Detecta alterações relevantes no cadastro do evento
-- ---------------------------------------------------------------------------

create or replace function public.geofence_event_has_checkin_relevant_changes(
  p_old public.events,
  p_new public.events
)
returns boolean
language sql
immutable
as $$
  select
    p_old.name is distinct from p_new.name
    or p_old.event_date is distinct from p_new.event_date
    or p_old.event_local is distinct from p_new.event_local
    or p_old.max_capacity is distinct from p_new.max_capacity
    or coalesce(p_old.kids_room, false) is distinct from coalesce(p_new.kids_room, false)
    or coalesce(p_old.teens_room, false) is distinct from coalesce(p_new.teens_room, false)
    or coalesce(p_old.parm_ofertas, false) is distinct from coalesce(p_new.parm_ofertas, false)
    or coalesce(p_old.totem_ativo, false) is distinct from coalesce(p_new.totem_ativo, false)
    or coalesce(p_old.requer_quorum, false) is distinct from coalesce(p_new.requer_quorum, false)
    or coalesce(p_old.somente_membros, false) is distinct from coalesce(p_new.somente_membros, false)
    or coalesce(p_old.geofence_ativo, false) is distinct from coalesce(p_new.geofence_ativo, false);
$$;

-- ---------------------------------------------------------------------------
-- 2. Remove check-ins de eventos com geofence vinculados a um local favorito
-- ---------------------------------------------------------------------------

create or replace function public.normalize_location_key(p_value text)
returns text
language sql
immutable
as $$
  select lower(trim(translate(
    coalesce(p_value, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  )));
$$;

create or replace function public.purge_geofence_checkins_for_events_matching_location(p_location_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.checkins c
  where c.event_id in (
    select e.id
    from public.events e
    where coalesce(e.geofence_ativo, false) = true
      and public.normalize_location_key(e.event_local) = public.normalize_location_key(p_location_name)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Remove todos os check-ins do evento (pre_checkin e confirmado)
-- ---------------------------------------------------------------------------

create or replace function public.session_can_purge_geofence_event_checkins()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when pg_trigger_depth() > 0 then true
    when coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then true
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'session_has_resource_access'
    ) then public.session_has_resource_access('table', 'events', 'update')
    else true
  end;
$$;

create or replace function public.purge_event_checkins_for_geofence_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.session_can_purge_geofence_event_checkins() then
    raise exception 'Não autorizado a invalidar check-ins do evento.';
  end if;

  delete from public.checkins c
  where c.event_id = p_event_id;

  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

-- Compatibilidade com versão anterior do script
create or replace function public.purge_confirmed_checkins_for_geofence_event(p_event_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.purge_event_checkins_for_geofence_event(p_event_id);
$$;

revoke all on function public.purge_event_checkins_for_geofence_event(uuid) from public, anon, authenticated;
revoke all on function public.purge_confirmed_checkins_for_geofence_event(uuid) from public, anon, authenticated;

grant execute on function public.purge_event_checkins_for_geofence_event(uuid) to service_role;
grant execute on function public.purge_confirmed_checkins_for_geofence_event(uuid) to service_role;

create or replace function public.purge_geofence_checkins_on_event_update(
  p_old public.events,
  p_new public.events
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_old.geofence_ativo, false) is not true
     and coalesce(p_new.geofence_ativo, false) is not true then
    return;
  end if;

  if not public.geofence_event_has_checkin_relevant_changes(p_old, p_new) then
    return;
  end if;

  perform public.purge_event_checkins_for_geofence_event(p_old.id);
end;
$$;

create or replace function public.trg_purge_event_checkins_on_geofence_event_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.purge_geofence_checkins_on_event_update(OLD, NEW);
  return NEW;
end;
$$;

-- Compatibilidade com nome anterior do trigger handler
create or replace function public.trg_purge_confirmed_checkins_on_geofence_event_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.purge_geofence_checkins_on_event_update(OLD, NEW);
  return NEW;
end;
$$;

drop trigger if exists events_purge_geofence_checkins_on_update on public.events;

create trigger events_purge_geofence_checkins_on_update
  after update on public.events
  for each row
  execute function public.trg_purge_event_checkins_on_geofence_event_update();

-- ---------------------------------------------------------------------------
-- 4. Locais favoritos: nome, coordenadas e status afetam o geofence do evento
-- ---------------------------------------------------------------------------

create or replace function public.favorite_location_has_geofence_relevant_changes(
  p_old public.event_favorite_locations,
  p_new public.event_favorite_locations
)
returns boolean
language sql
immutable
as $$
  select
    p_old.name is distinct from p_new.name
    or p_old.latitude is distinct from p_new.latitude
    or p_old.longitude is distinct from p_new.longitude
    or coalesce(p_old.is_active, true) is distinct from coalesce(p_new.is_active, true);
$$;

create or replace function public.purge_geofence_checkins_on_favorite_location_change(
  p_old public.event_favorite_locations,
  p_new public.event_favorite_locations,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if p_operation = 'UPDATE'
     and not public.favorite_location_has_geofence_relevant_changes(p_old, p_new) then
    return;
  end if;

  foreach v_name in array array[p_old.name, case when p_operation = 'UPDATE' then p_new.name end]
  loop
    if v_name is not null then
      perform public.purge_geofence_checkins_for_events_matching_location(v_name);
    end if;
  end loop;
end;
$$;

create or replace function public.trg_purge_event_checkins_on_favorite_location_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.purge_geofence_checkins_on_favorite_location_change(OLD, NEW, TG_OP);
  return coalesce(NEW, OLD);
end;
$$;

-- Compatibilidade com nome anterior do trigger handler
create or replace function public.trg_purge_confirmed_checkins_on_favorite_location_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.purge_geofence_checkins_on_favorite_location_change(OLD, NEW, TG_OP);
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists event_favorite_locations_purge_geofence_checkins on public.event_favorite_locations;

create trigger event_favorite_locations_purge_geofence_checkins
  after update or delete on public.event_favorite_locations
  for each row
  execute function public.trg_purge_event_checkins_on_favorite_location_change();

notify pgrst, 'reload schema';
