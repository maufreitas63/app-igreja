-- =============================================================================
-- Salas do evento: enabled_room_keys (todas as salas da instância)
-- =============================================================================
-- Mantém kids_room / teens_room sincronizados para check-in legado.
-- Execute no SQL Editor do Supabase (idempotente).
-- =============================================================================

alter table public.events
  add column if not exists enabled_room_keys text[] not null default '{}'::text[];

comment on column public.events.enabled_room_keys is
  'Códigos de salas habilitadas no evento (ex.: KIDS, TEENS, HOMENS). Sincroniza kids_room/teens_room.';

-- Backfill a partir dos booleans legados
update public.events
   set enabled_room_keys = array_remove(
     array[
       case when kids_room is true then 'KIDS' else null end,
       case when teens_room is true then 'TEENS' else null end
     ],
     null
   )
 where coalesce(cardinality(enabled_room_keys), 0) = 0
   and (kids_room is true or teens_room is true);

create or replace function public.ensure_events_enabled_room_keys_column()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.events
    add column if not exists enabled_room_keys text[] not null default '{}'::text[];

  update public.events
     set enabled_room_keys = array_remove(
       array[
         case when kids_room is true then 'KIDS' else null end,
         case when teens_room is true then 'TEENS' else null end
       ],
       null
     )
   where coalesce(cardinality(enabled_room_keys), 0) = 0
     and (kids_room is true or teens_room is true);

  return true;
end;
$$;

grant execute on function public.ensure_events_enabled_room_keys_column()
  to anon, authenticated, service_role;

-- Manter kids_room / teens_room alinhados ao array (insert/update)
create or replace function public.sync_event_room_booleans_from_keys()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[] := '{}'::text[];
begin
  select coalesce(
           array_agg(v_key order by v_key),
           '{}'::text[]
         )
    into v_keys
    from (
      select distinct upper(trim(k)) as v_key
        from unnest(coalesce(new.enabled_room_keys, '{}'::text[])) as k
       where trim(coalesce(k, '')) <> ''
         and upper(trim(k)) ~ '^[A-Z0-9_]{2,40}$'
    ) normalized;

  -- Legado: se o array veio vazio, monta a partir dos booleans
  if coalesce(cardinality(v_keys), 0) = 0 then
    if new.kids_room is true then
      v_keys := array_append(v_keys, 'KIDS');
    end if;
    if new.teens_room is true then
      v_keys := array_append(v_keys, 'TEENS');
    end if;
  end if;

  new.enabled_room_keys := v_keys;
  new.kids_room := 'KIDS' = any (v_keys);
  new.teens_room := 'TEENS' = any (v_keys);
  return new;
end;
$$;

drop trigger if exists trg_sync_event_room_booleans on public.events;
create trigger trg_sync_event_room_booleans
  before insert or update of enabled_room_keys, kids_room, teens_room
  on public.events
  for each row
  execute function public.sync_event_room_booleans_from_keys();

notify pgrst, 'reload schema';

select
  'events.enabled_room_keys ok' as status,
  (select count(*) from public.events where cardinality(enabled_room_keys) > 0) as events_with_rooms;
