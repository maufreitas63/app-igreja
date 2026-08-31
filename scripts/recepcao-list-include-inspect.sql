-- Inclui a inspeção de família/matches na listagem da recepção (sem segundo clique).
-- Aplica: npx supabase db query --linked -f scripts/recepcao-list-include-inspect.sql

create or replace function public.list_recepcao_cadastro_familiar_pending(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
        'submission_id', l.id,
        'created_at', l.created_at,
        'member_count', l.member_count,
        'detected_family_id', l.detected_family_id,
        'has_family_conflict', l.has_family_conflict,
        'members', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'full_name', m.full_name,
              'is_informant', m.is_informant,
              'relationship', m.relationship,
              'phone', m.phone,
              'birth_date', m.birth_date,
              'cep', m.cep,
              'detected_family_id', m.detected_family_id,
              'matched_profile_id', m.matched_profile_id,
              'matched_member_id', m.matched_member_id
            )
            order by m.is_informant desc, m.full_name
          ), '[]'::jsonb)
          from public.recepcao_cadastro_familiar m
          where m.tenant_id = v_tenant
            and m.submission_id = l.id
            and m.status = 'pending'
        ),
        'family_inspect', public.inspect_recepcao_lote_family(l.id)
      ) as row_data,
      l.created_at
      from public.recepcao_cadastro_familiar_lote l
      where l.tenant_id = v_tenant
        and l.status = 'pending'
      order by l.created_at desc
      limit greatest(coalesce(p_limit, 50), 1)
    ) q;

  return jsonb_build_object('success', true, 'submissions', v_rows);
end;
$$;

grant execute on function public.list_recepcao_cadastro_familiar_pending(integer) to anon, authenticated;
