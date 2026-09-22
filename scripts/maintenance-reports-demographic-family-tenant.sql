-- Relatório demographic_family lia public.profiles sem tenant (SECURITY DEFINER ignora RLS).
create or replace function public._report_demographic_family(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
  v_summary jsonb;
begin
  with ages as (
    select
      coalesce(nullif(trim(p.family_id), ''), '(sem família)') as familia,
      case
        when p.birth_date is null then 'Sem data'
        when age(current_date, p.birth_date) < interval '13 years' then '0-12 anos'
        when age(current_date, p.birth_date) < interval '18 years' then '13-17 anos'
        when age(current_date, p.birth_date) < interval '30 years' then '18-29 anos'
        when age(current_date, p.birth_date) < interval '45 years' then '30-44 anos'
        when age(current_date, p.birth_date) < interval '60 years' then '45-59 anos'
        else '60+ anos'
      end as faixa_etaria
    from public.profiles p
    where p.tenant_id = v_tenant
      and coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
  ),
  family_sizes as (
    select
      familia,
      count(*)::int as integrantes
    from ages
    group by familia
  )
  select
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tipo', 'faixa_etaria',
          'faixa', a.faixa_etaria,
          'quantidade', a.quantidade
        )
        order by a.quantidade desc
      )
      from (
        select faixa_etaria, count(*)::int as quantidade
        from ages
        group by faixa_etaria
      ) a
    ), '[]'::jsonb)
    ||
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tipo', 'tamanho_familia',
          'familia', f.familia,
          'integrantes', f.integrantes,
          'classificacao', case
            when f.integrantes = 1 then 'Individual'
            when f.integrantes between 2 and 3 then 'Família pequena'
            else 'Família grande'
          end
        )
        order by f.integrantes desc
      )
      from family_sizes f
    ), '[]'::jsonb),
    jsonb_build_object(
      'perfis_analisados', (select count(*) from ages),
      'familias_distintas', (select count(*) from family_sizes),
      'media_integrantes', round((select avg(integrantes)::numeric from family_sizes), 2)
    )
  into v_rows, v_summary;

  return public._maintenance_report_payload(
    'demographic_family',
    array['tipo', 'faixa', 'quantidade', 'familia', 'integrantes', 'classificacao'],
    v_rows,
    v_summary
  );
end;
$$;

grant execute on function public._report_demographic_family(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
