-- Audiência: expõe room_released para o selo Liberado (substitui Na sala).

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
  room_entry_checked boolean,
  room_released boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_family text := nullif(upper(trim(coalesce(p_family_id, ''))), '');
begin
  return query
  select
    er.profile_id,
    er.family_id,
    er.full_name,
    er.kids_status,
    coalesce(er.room_entry_checked, false),
    coalesce(er.room_released, false)
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and er.event_id = p_event_id
    and (
      (v_family is not null and upper(trim(coalesce(er.family_id, ''))) = v_family)
      or (
        v_family is not null
        and exists (
          select 1
            from public.profiles p
           where p.id = er.profile_id
             and upper(trim(coalesce(p.family_id, p.codigo_membro, ''))) = v_family
        )
      )
    )
  order by er.created_at desc;
end;
$$;

grant execute on function public.get_registered_event_members(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
