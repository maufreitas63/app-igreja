-- =============================================================================
-- Término do evento (duração padrão: 1 hora após o início)
-- Aplica: npx supabase db query --linked -f scripts/events-event-end-date.sql
-- =============================================================================

alter table public.events
  add column if not exists event_end_date timestamptz;

comment on column public.events.event_end_date is
  'Término do evento (mesmo fuso de event_date). Padrão: 1 hora após o início.';

update public.events
   set event_end_date = event_date + interval '1 hour'
 where event_end_date is null
   and event_date is not null;

create or replace function public.ensure_events_event_end_date_column()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.events
    add column if not exists event_end_date timestamptz;

  update public.events
     set event_end_date = event_date + interval '1 hour'
   where event_end_date is null
     and event_date is not null;

  return true;
end;
$$;

grant execute on function public.ensure_events_event_end_date_column() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
