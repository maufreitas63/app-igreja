-- Check-in automático por proximidade (geofence) por evento.
-- Execute UMA VEZ no SQL Editor do Supabase (idempotente).

alter table public.events
  add column if not exists geofence_ativo boolean;

update public.events
set geofence_ativo = false
where geofence_ativo is null;

alter table public.events
  alter column geofence_ativo set default false,
  alter column geofence_ativo set not null;

comment on column public.events.geofence_ativo is
  'Quando true, habilita check-in automático por proximidade (geofence) para este evento.';

create or replace function public.ensure_events_geofence_ativo_column()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.events
    add column if not exists geofence_ativo boolean;

  update public.events
  set geofence_ativo = false
  where geofence_ativo is null;

  alter table public.events
    alter column geofence_ativo set default false,
    alter column geofence_ativo set not null;

  return true;
end;
$$;

grant execute on function public.ensure_events_geofence_ativo_column() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
