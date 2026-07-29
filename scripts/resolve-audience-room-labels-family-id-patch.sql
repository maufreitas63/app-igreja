-- resolve_audience_room_labels: também por family_id (crianças sem telefone).
-- Antes só filtrava por telefone; Emma/Otto (phone null) nunca voltavam na audiência.

drop function if exists public.resolve_audience_room_labels(text[]);

create or replace function public.resolve_audience_room_labels(
  p_phones text[] default null,
  p_family_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_family text := nullif(trim(coalesce(p_family_id, '')), '');
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profile_id', p.id,
      'phone', p.phone,
      'full_name', p.full_name,
      'room_key', eff.room_key,
      'room_label', eff.room_label,
      'room_kind', eff.room_kind
    )
  ), '[]'::jsonb)
    into v_rows
    from public.profiles p
    join public.profile_igreja_vinculos v
      on v.profile_id = p.id
     and v.tenant_id = v_tenant
    join lateral public.effective_user_room(v_tenant, p.id, current_date) eff on true
   where eff.room_key is not null
     and (
       (
         v_family is not null
         and lower(trim(coalesce(p.family_id, p.codigo_membro, ''))) = lower(v_family)
       )
       or (
         p_phones is not null
         and cardinality(p_phones) > 0
         and (
           p.phone = any (p_phones)
           or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = any (
             select regexp_replace(coalesce(x, ''), '\D', '', 'g')
               from unnest(p_phones) as x
              where nullif(trim(coalesce(x, '')), '') is not null
           )
         )
       )
     );

  return v_rows;
end;
$$;

grant execute on function public.resolve_audience_room_labels(text[], text) to anon, authenticated;

notify pgrst, 'reload schema';
