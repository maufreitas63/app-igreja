-- =============================================================================
-- Patch: sync_event_room_booleans_from_keys (DISTINCT + ORDER BY inválido)
-- =============================================================================
-- Erro ao salvar salas customizadas (ex.: Homens):
--   "in an aggregate with DISTINCT, ORDER BY expressions must appear in argument list"
-- Execute no SQL Editor do Supabase (idempotente).
-- =============================================================================

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

notify pgrst, 'reload schema';

select 'sync_event_room_booleans_from_keys patched' as status;
