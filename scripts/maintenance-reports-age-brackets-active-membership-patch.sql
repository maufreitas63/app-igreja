-- Patch: Faixa Etária alinhada ao card Mudança de Papéis (membros/congregados ativos).
-- Execute no SQL Editor do Supabase APÓS access-control-pastoral-congregado-membership.sql
-- Depois: Settings → API → Reload schema.

create or replace function public._maintenance_report_eligible_member_congregado()
returns table (
  profile_id uuid,
  nome text,
  birth_date date,
  role_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as profile_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as nome,
    p.birth_date,
    public.resolve_basic_role_code_for_profile(p.id) as role_code
  from public.profiles p
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
    and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
    and coalesce(eff.membership_out::text, '') = '';
$$;

grant execute on function public._maintenance_report_eligible_member_congregado() to anon, authenticated;

create or replace function public._report_demographic_age_brackets(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
begin
  with eligible as (
    select
      e.nome,
      e.birth_date,
      e.role_code
    from public._maintenance_report_eligible_member_congregado() e
  ),
  profile_ages as (
    select
      e.nome,
      e.role_code,
      case
        when e.birth_date is null then 'Sem data'
        when age(current_date, e.birth_date) < interval '13 years' then '0-12 anos'
        when age(current_date, e.birth_date) < interval '18 years' then '13-17 anos'
        when age(current_date, e.birth_date) < interval '30 years' then '18-29 anos'
        when age(current_date, e.birth_date) < interval '45 years' then '30-44 anos'
        when age(current_date, e.birth_date) < interval '60 years' then '45-59 anos'
        else '60+ anos'
      end as faixa
    from eligible e
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'faixa', g.faixa,
        'quantidade', g.quantidade,
        'integrantes', g.integrantes
      )
      order by case g.faixa
        when '60+ anos' then 1
        when '45-59 anos' then 2
        when '30-44 anos' then 3
        when '18-29 anos' then 4
        when '13-17 anos' then 5
        when '0-12 anos' then 6
        when 'Sem data' then 7
        else 99
      end asc
    ), '[]'::jsonb),
    jsonb_build_object(
      'membros_ativos', (select count(*)::int from profile_ages where role_code = 'member'),
      'congregados_ativos', (select count(*)::int from profile_ages where role_code = 'congregado'),
      'perfis_analisados', (select count(*)::int from profile_ages)
    )
  into v_rows, v_summary
  from (
    select
      faixa,
      count(*)::int as quantidade,
      coalesce(jsonb_agg(nome order by nome), '[]'::jsonb) as integrantes
    from profile_ages
    group by faixa
  ) g;

  return public._maintenance_report_payload(
    'demographic_age_brackets',
    array['faixa', 'quantidade'],
    v_rows,
    v_summary
  );
end;
$$;
