-- Agenda da família: devolve se o check-in na sala Kids/Teens já foi feito.
-- DROP necessário: CREATE OR REPLACE não altera o RETURNS TABLE.

drop function if exists public.get_registered_event_members(uuid, text);

create or replace function public.get_registered_event_members(
  p_event_id uuid,
  p_family_id text
)
returns table (
  profile_id uuid,
  family_id text,
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
    er.profile_id,
    er.family_id,
    er.full_name,
    er.kids_status,
    coalesce(er.room_entry_checked, false)
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and er.event_id = p_event_id
    and er.family_id = p_family_id
  order by er.created_at desc;
end;
$$;

grant execute on function public.get_registered_event_members(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
