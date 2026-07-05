-- Relatório: Membros e Congregados ativos por faixa etária (matriz).
-- Colunas: Membros | Congregados | Total
-- Linhas: Infantil, Adolescente, Jovem, Adulto, 60+, Sem data de nascimento, Total
--
-- Pré-requisitos:
--   scripts/maintenance-reports-access.sql
--   scripts/access-control-pastoral-congregado-membership.sql
--   scripts/maintenance-reports-rpc.sql (base)
--
-- Execute no SQL Editor do Supabase. Depois: Settings → API → Reload schema.

create or replace function public._report_active_members_age_matrix(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
begin
  with ativos as (
    select
      public.resolve_basic_role_code_for_profile(p.id) as role_code,
      case
        when p.birth_date is null then 'Sem data de nascimento'
        when date_part('year', age(current_date, p.birth_date))::int between 0 and 11 then 'Infantil'
        when date_part('year', age(current_date, p.birth_date))::int between 12 and 17 then 'Adolescente'
        when date_part('year', age(current_date, p.birth_date))::int between 18 and 29 then 'Jovem'
        when date_part('year', age(current_date, p.birth_date))::int between 30 and 59 then 'Adulto'
        when date_part('year', age(current_date, p.birth_date))::int >= 60 then '60+'
        else 'Sem data de nascimento'
      end as categoria
    from public.profiles p
    cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
    where coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(p.phone), ''),
        nullif(trim(p.codigo_membro), '')
      ) is not null
      and coalesce(p.codigo_membro, '') not ilike 'TstMax%'
      and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
      and coalesce(eff.membership_out::text, '') = ''
  ),
  categorias as (
    select *
    from (
      values
        (1, 'Infantil'),
        (2, 'Adolescente'),
        (3, 'Jovem'),
        (4, 'Adulto'),
        (5, '60+'),
        (6, 'Sem data de nascimento')
    ) as c(ordem, categoria)
  ),
  matrix as (
    select
      c.categoria,
      c.ordem,
      coalesce(count(*) filter (where a.role_code = 'member'), 0)::int as membros,
      coalesce(count(*) filter (where a.role_code = 'congregado'), 0)::int as congregados
    from categorias c
    left join ativos a on a.categoria = c.categoria
    group by c.categoria, c.ordem
  ),
  with_totals as (
    select
      m.categoria,
      m.ordem,
      m.membros,
      m.congregados,
      (m.membros + m.congregados)::int as total
    from matrix m
    union all
    select
      'Total'::text,
      99,
      coalesce(sum(m.membros), 0)::int,
      coalesce(sum(m.congregados), 0)::int,
      coalesce(sum(m.membros + m.congregados), 0)::int
    from matrix m
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'categoria', w.categoria,
        'membros', w.membros,
        'congregados', w.congregados,
        'total', w.total
      )
      order by w.ordem
    ), '[]'::jsonb),
    jsonb_build_object(
      'membros_ativos', coalesce(sum(w.membros) filter (where w.categoria <> 'Total'), 0),
      'congregados_ativos', coalesce(sum(w.congregados) filter (where w.categoria <> 'Total'), 0),
      'total_ativos', coalesce(sum(w.total) filter (where w.categoria <> 'Total'), 0)
    )
  into v_rows, v_summary
  from with_totals w;

  return public._maintenance_report_payload(
    'active_members_age_matrix',
    array['categoria', 'membros', 'congregados', 'total'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public.gerar_relatorio_manutencao(
  p_actor_profile_id uuid,
  p_report_code text,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(btrim(coalesce(p_report_code, '')));
begin
  if v_code = 'health_alerts' then
    perform public.assert_maintenance_reports_health_actor(p_actor_profile_id);
  else
    perform public.assert_maintenance_reports_actor(p_actor_profile_id);
  end if;

  case v_code
    when 'members_active_inactive' then
      return public._report_members_active_inactive(coalesce(p_params, '{}'::jsonb));
    when 'pastoral_needs' then
      return public._report_pastoral_needs(coalesce(p_params, '{}'::jsonb));
    when 'demographic_age_brackets' then
      return public._report_demographic_age_brackets(coalesce(p_params, '{}'::jsonb));
    when 'active_members_age_matrix' then
      return public._report_active_members_age_matrix(coalesce(p_params, '{}'::jsonb));
    when 'health_alerts' then
      return public._report_health_alerts(coalesce(p_params, '{}'::jsonb));
    when 'quorum_official' then
      return public._report_quorum_official(coalesce(p_params, '{}'::jsonb));
    when 'parking_estimate' then
      return public._report_parking_estimate(coalesce(p_params, '{}'::jsonb));
    when 'support_suggestions' then
      return public._report_support_suggestions(coalesce(p_params, '{}'::jsonb));
    when 'event_registrations' then
      return public._report_event_registrations(coalesce(p_params, '{}'::jsonb));
    else
      return jsonb_build_object(
        'success', false,
        'report_code', v_code,
        'message', 'Relatório não reconhecido: ' || v_code
      );
  end case;
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'report_code', v_code,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public._report_active_members_age_matrix(jsonb) to anon, authenticated;
grant execute on function public.gerar_relatorio_manutencao(uuid, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
