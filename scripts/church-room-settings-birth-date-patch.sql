-- Idade + evento atual/próximo na atribuição de salas (configuração de salas).
-- Execute no SQL Editor do Supabase (idempotente).

create or replace function public.list_profiles_for_room_assignment(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_q text := lower(trim(coalesce(p_search, '')));
  v_rows jsonb;
begin
  perform public.assert_church_room_manager(v_actor);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profile_id', p.id,
      'full_name', p.full_name,
      'phone', p.phone,
      'birth_date', p.birth_date,
      'registered_event_name', (
        select coalesce(nullif(trim(e.name), ''), 'Evento')
          from public.event_registrations er
          join public.events e on e.id = er.event_id
         where er.profile_id = p.id
           and e.event_date is not null
           and e.event_date::date >= current_date
         order by e.event_date asc
         limit 1
      ),
      'room_key', a.room_key,
      'room_label', coalesce(nullif(trim(s.display_label), ''), a.room_key)
    )
    order by lower(coalesce(p.full_name, '')), p.phone
  ), '[]'::jsonb)
    into v_rows
    from public.profiles p
    join public.profile_igreja_vinculos v
      on v.profile_id = p.id
     and v.tenant_id = v_tenant
    left join public.user_room_assignment a
      on a.profile_id = p.id
     and a.tenant_id = v_tenant
    left join public.church_room_settings s
      on s.tenant_id = v_tenant
     and s.room_key = a.room_key
   where (
     v_q = ''
     or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
     or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
   );

  return v_rows;
end;
$$;

grant execute on function public.list_profiles_for_room_assignment(text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'list_profiles_for_room_assignment: birth_date + registered_event_name ok' as status;
