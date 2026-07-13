-- =============================================================================
-- Patch: atribuição de salas lista apenas usuários Ativos
-- =============================================================================
-- Ativo = profiles.membership_out IS NULL (mesmo critério do app / membros).
-- Execute no Supabase após scripts/church-room-settings-special-rooms.sql
-- =============================================================================

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
      'room_key', eff.room_key,
      'room_label', eff.room_label,
      'room_kind', eff.room_kind,
      'padrao_room_key', eff.padrao_room_key,
      'padrao_room_label', eff.padrao_room_label,
      'especial_room_key', eff.especial_room_key,
      'especial_room_label', eff.especial_room_label,
      'especial_end_date', eff.especial_end_date
    )
    order by lower(coalesce(p.full_name, '')), p.phone
  ), '[]'::jsonb)
    into v_rows
    from public.profiles p
    join public.profile_igreja_vinculos v
      on v.profile_id = p.id
     and v.tenant_id = v_tenant
    left join lateral public.effective_user_room(v_tenant, p.id, current_date) eff on true
   where p.membership_out is null
     and (
       v_q = ''
       or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
       or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
     );

  return v_rows;
end;
$$;

grant execute on function public.list_profiles_for_room_assignment(text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'church-room-settings-active-profiles-only-patch: ok' as status;
