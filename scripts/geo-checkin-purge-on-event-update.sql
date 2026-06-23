-- Invalida check-ins do evento quando há alteração em evento com check-in automático
-- ou quando coordenadas/nome de local favorito vinculado mudam.
-- Execute no SQL Editor do Supabase (idempotente).
--
-- Pré-requisitos: checkins-totem-flow.sql, events-geofence-ativo.sql

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
-- 2. Remove todos os check-ins do evento (pre_checkin e confirmado)
-- ---------------------------------------------------------------------------

create or replace function public.purge_event_checkins_for_geofence_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
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

grant execute on function public.purge_event_checkins_for_geofence_event(uuid)
  to anon, authenticated, service_role;

grant execute on function public.purge_confirmed_checkins_for_geofence_event(uuid)
  to anon, authenticated, service_role;

create or replace function public.trg_purge_confirmed_checkins_on_geofence_event_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(OLD.geofence_ativo, false) is not true
     and coalesce(NEW.geofence_ativo, false) is not true then
    return NEW;
  end if;

  if not public.geofence_event_has_checkin_relevant_changes(OLD, NEW) then
    return NEW;
  end if;

  perform public.purge_event_checkins_for_geofence_event(OLD.id);
  return NEW;
end;
$$;

drop trigger if exists events_purge_geofence_checkins_on_update on public.events;

create trigger events_purge_geofence_checkins_on_update
  after update on public.events
  for each row
  execute function public.trg_purge_confirmed_checkins_on_geofence_event_update();

-- ---------------------------------------------------------------------------
-- 3. Locais favoritos: coordenadas/nome/endereço afetam o geofence do evento
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
    or p_old.address is distinct from p_new.address
    or p_old.latitude is distinct from p_new.latitude
    or p_old.longitude is distinct from p_new.longitude
    or p_old.capacity is distinct from p_new.capacity;
$$;

create or replace function public.trg_purge_confirmed_checkins_on_favorite_location_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
     and not public.favorite_location_has_geofence_relevant_changes(OLD, NEW) then
    return NEW;
  end if;

  delete from public.checkins c
  where c.event_id in (
    select e.id
    from public.events e
    where coalesce(e.geofence_ativo, false) = true
      and (
        lower(trim(coalesce(e.event_local, ''))) = lower(trim(coalesce(OLD.name, '')))
        or (
          TG_OP = 'UPDATE'
          and lower(trim(coalesce(e.event_local, ''))) = lower(trim(coalesce(NEW.name, '')))
        )
      )
  );

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists event_favorite_locations_purge_geofence_checkins on public.event_favorite_locations;

create trigger event_favorite_locations_purge_geofence_checkins
  after update on public.event_favorite_locations
  for each row
  execute function public.trg_purge_confirmed_checkins_on_favorite_location_update();

notify pgrst, 'reload schema';
