-- RPCs do catálogo de relatórios de manutenção.
-- Pré-requisitos: scripts/maintenance-reports-access.sql
-- Execute no SQL Editor do Supabase.

create or replace function public._maintenance_report_payload(
  p_report_code text,
  p_columns text[],
  p_rows jsonb,
  p_summary jsonb default '{}'::jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'success', true,
    'report_code', p_report_code,
    'generated_at', now(),
    'columns', to_jsonb(p_columns),
    'rows', coalesce(p_rows, '[]'::jsonb),
    'summary', coalesce(p_summary, '{}'::jsonb)
  );
$$;

create or replace function public._parse_report_month(p_value text)
returns date
language plpgsql
immutable
as $$
declare
  v_parts text[];
begin
  if p_value is null or btrim(p_value) = '' then
    return date_trunc('month', current_date)::date;
  end if;

  v_parts := regexp_split_to_array(btrim(p_value), '-');

  if array_length(v_parts, 1) >= 2 then
    return make_date(v_parts[1]::int, v_parts[2]::int, 1);
  end if;

  return date_trunc('month', current_date)::date;
end;
$$;

-- Datas efetivas de membresia (herança familiar para congregados) — usado pelo relatório de membros.
create or replace function public._maintenance_is_family_guardian_relationship(p_relationship text)
returns boolean
language sql
immutable
as $$
  select lower(trim(translate(
    coalesce(p_relationship, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ))) in ('representante legal', 'pai', 'mae');
$$;

create or replace function public._maintenance_resolve_profile_guardian_profile_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select
      p.id,
      upper(nullif(trim(coalesce(p.family_id, '')), '')) as family_id
    from public.profiles p
    where p.id = p_profile_id
  )
  select gp.id
  from target t
  join public.members m
    on upper(trim(coalesce(m.family_id, ''))) = t.family_id
  join public.profiles gp
    on public.directory_person_matches_member(m.full_name, m.phone, gp.full_name, gp.phone)
  where t.family_id is not null
    and public._maintenance_is_family_guardian_relationship(m.relationship)
    and gp.id <> t.id
  order by case lower(trim(translate(
      coalesce(m.relationship, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    )))
      when 'representante legal' then 0
      when 'pai' then 1
      when 'mae' then 2
      else 99
    end,
    gp.full_name asc
  limit 1;
$$;

create or replace function public.resolve_effective_membership_dates_for_profile(p_profile_id uuid)
returns table (
  membership_date date,
  membership_out date,
  membership_inherited boolean,
  inherited_from_profile_id uuid,
  inherited_from_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_own_date date;
  v_own_out date;
  v_guardian_id uuid;
begin
  select
    public.resolve_basic_role_code_for_profile(p.id),
    p.membership_date,
    p.membership_out
  into v_role, v_own_date, v_own_out
  from public.profiles p
  where p.id = p_profile_id;

  if coalesce(v_role, '') <> 'congregado' then
    return query
    select v_own_date, v_own_out, false, null::uuid, null::text;
    return;
  end if;

  v_guardian_id := public._maintenance_resolve_profile_guardian_profile_id(p_profile_id);

  if v_guardian_id is null then
    return query
    select v_own_date, v_own_out, false, null::uuid, null::text;
    return;
  end if;

  return query
  select
    gp.membership_date,
    gp.membership_out,
    true,
    gp.id,
    coalesce(nullif(trim(gp.full_name), ''), '(responsável)')
  from public.profiles gp
  where gp.id = v_guardian_id;
end;
$$;

grant execute on function public.resolve_effective_membership_dates_for_profile(uuid) to anon, authenticated;

create or replace function public._report_members_active_inactive(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months integer;
  v_cutoff timestamptz;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_months := greatest(1, least(coalesce((p_params->>'inactive_months')::int, 3), 24));
  v_cutoff := now() - make_interval(months => v_months);

  with activity as (
    select
      p.id,
      coalesce(nullif(trim(p.full_name), ''), '(sem nome)') as full_name,
      public.resolve_basic_role_code_for_profile(p.id) as role_code,
      greatest(0, (current_date - p.created_at::date)) as congregation_days,
      eff.membership_out as effective_membership_out,
      (
        exists (
          select 1
            from public.profile_app_access_events e
           where e.profile_id = p.id
             and e.accessed_at >= v_cutoff
        )
        or exists (
          select 1
            from public.checkins c
           where c.profile_id = p.id
             and coalesce(c.timestamp_confirmacao, c.created_at) >= v_cutoff
        )
      ) as has_recent_activity,
      case
        when public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado') then
          coalesce(eff.membership_out::text, '') = ''
        else
          (
            exists (
              select 1
                from public.profile_app_access_events e
               where e.profile_id = p.id
                 and e.accessed_at >= v_cutoff
            )
            or exists (
              select 1
                from public.checkins c
               where c.profile_id = p.id
                 and coalesce(c.timestamp_confirmacao, c.created_at) >= v_cutoff
            )
          )
      end as is_active
    from public.profiles p
    cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
    where coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'nome', a.full_name,
        'papel', a.role_code,
        'dias_congregacao', a.congregation_days,
        'status', case when a.is_active then 'Ativo' else 'Inativo' end
      )
      order by
        case when a.is_active then 0 else 1 end,
        case a.role_code
          when 'member' then 1
          when 'congregado' then 2
          when 'visitante' then 3
          else 4
        end,
        a.full_name
    ), '[]'::jsonb),
    jsonb_build_object(
      'visitantes', count(*) filter (where role_code = 'visitante'),
      'membros', count(*) filter (
        where role_code = 'member' and coalesce(effective_membership_out::text, '') = ''
      ),
      'membros_desligados', count(*) filter (
        where role_code = 'member' and coalesce(effective_membership_out::text, '') <> ''
      ),
      'congregados', count(*) filter (
        where role_code = 'congregado' and coalesce(effective_membership_out::text, '') = ''
      ),
      'congregados_desligados', count(*) filter (
        where role_code = 'congregado' and coalesce(effective_membership_out::text, '') <> ''
      ),
      'ativos', count(*) filter (where is_active),
      'inativos', count(*) filter (where not is_active),
      'janela_meses', v_months
    )
  into v_rows, v_summary
  from activity a;

  return public._maintenance_report_payload(
    'members_active_inactive',
    array['nome', 'papel', 'dias_congregacao', 'status'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_financial_flow(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_budget text;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_month := public._parse_report_month(p_params->>'referencia_mes');
  v_budget := upper(coalesce(nullif(btrim(p_params->>'budget_version'), ''), 'REALIZADO'));

  with bounds as (
    select
      v_month as month_start,
      (v_month + interval '1 month - 1 day')::date as month_end
  ),
  grouped as (
    select
      coalesce(nullif(trim(f.ministry), ''), 'Sem ministério') as categoria,
      coalesce(nullif(trim(f.transaction_kind), ''), 'outros') as tipo,
      sum(f.amount)::numeric(14, 2) as total
    from public.financials f
    cross join bounds b
    where f.transaction_date between b.month_start and b.month_end
      and upper(coalesce(f.budget_version, '')) = v_budget
    group by 1, 2
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'categoria', g.categoria,
        'tipo', g.tipo,
        'total', g.total
      )
      order by g.total desc
    ), '[]'::jsonb),
    jsonb_build_object(
      'mes_referencia', to_char(v_month, 'YYYY-MM'),
      'budget_version', v_budget,
      'total_lancamentos', (select count(*) from public.financials f cross join bounds b where f.transaction_date between b.month_start and b.month_end and upper(coalesce(f.budget_version, '')) = v_budget),
      'rds_conciliados', (
        select count(*)
          from public.expense_reports er
         where er.status = 'reconciled'
           and er.created_at::date between (select month_start from bounds) and (select month_end from bounds)
      )
    )
  into v_rows, v_summary
  from grouped g;

  return public._maintenance_report_payload(
    'financial_flow',
    array['categoria', 'tipo', 'total'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_territory_indicators(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
begin
  with base as (
    select
      coalesce(nullif(trim(p.address_neighborhood), ''), 'Sem bairro') as bairro,
      coalesce(nullif(trim(p.address_city), ''), 'Sem cidade') as cidade,
      g.latitude,
      g.longitude
    from public.profiles p
    left join public.cep_geolocations g
      on g.cep_digits = regexp_replace(coalesce(p.cep, ''), '\D', '', 'g')
    where coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
      and coalesce(p.membership_out::text, '') = ''
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'bairro', b.bairro,
        'cidade', b.cidade,
        'perfis', b.perfis,
        'latitude_media', b.latitude_media,
        'longitude_media', b.longitude_media
      )
      order by b.perfis desc, b.bairro
    ), '[]'::jsonb),
    jsonb_build_object(
      'bairros_distintos', count(*),
      'perfis_mapeados', coalesce(sum(b.perfis), 0)
    )
  into v_rows, v_summary
  from (
    select
      bairro,
      cidade,
      count(*)::int as perfis,
      round(avg(latitude)::numeric, 6) as latitude_media,
      round(avg(longitude)::numeric, 6) as longitude_media
    from base
    group by bairro, cidade
  ) b;

  return public._maintenance_report_payload(
    'territory_indicators',
    array['bairro', 'cidade', 'perfis', 'latitude_media', 'longitude_media'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_attendance_retention(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months integer;
  v_cutoff date;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_months := greatest(1, least(coalesce((p_params->>'retention_months')::int, 6), 24));
  v_cutoff := (current_date - make_interval(months => v_months))::date;

  with event_absence as (
    select
      e.id as event_id,
      e.name as evento,
      e.event_date,
      count(er.id)::int as inscritos,
      count(c.id) filter (where c.status = 'confirmado')::int as confirmados,
      greatest(count(er.id) - count(c.id) filter (where c.status = 'confirmado'), 0)::int as ausentes
    from public.events e
    join public.event_registrations er on er.event_id = e.id
    left join public.checkins c on c.event_registration_id = er.id
    where e.event_date >= v_cutoff
    group by e.id, e.name, e.event_date
  ),
  retention as (
    select
      p.id,
      coalesce(nullif(trim(p.full_name), ''), '(sem nome)') as nome,
      count(c.id) filter (where coalesce(c.timestamp_confirmacao, c.created_at)::date >= v_cutoff)::int as checkins_recentes
    from public.profiles p
    left join public.checkins c on c.profile_id = p.id
    group by p.id, p.full_name
  )
  select
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tipo', 'absenteismo',
          'evento', ea.evento,
          'data', ea.event_date,
          'inscritos', ea.inscritos,
          'confirmados', ea.confirmados,
          'ausentes', ea.ausentes
        )
        order by ea.event_date desc
      )
      from event_absence ea
    ), '[]'::jsonb)
    ||
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tipo', 'retencao',
          'nome', r.nome,
          'checkins_recentes', r.checkins_recentes,
          'alerta', case when r.checkins_recentes <= 1 then 'Queda de frequência' else 'Estável' end
        )
        order by r.checkins_recentes asc, r.nome
      )
      from retention r
      where r.checkins_recentes <= 1
    ), '[]'::jsonb),
    jsonb_build_object(
      'meses_analisados', v_months,
      'eventos_com_inscricoes', (select count(*) from event_absence),
      'perfis_em_alerta', (select count(*) from retention where checkins_recentes <= 1)
    )
  into v_rows, v_summary;

  return public._maintenance_report_payload(
    'attendance_retention',
    array['tipo', 'evento', 'data', 'inscritos', 'confirmados', 'ausentes', 'nome', 'checkins_recentes', 'alerta'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_pastoral_needs(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months integer;
  v_cutoff timestamptz;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_months := greatest(1, least(coalesce((p_params->>'semester_months')::int, 6), 12));
  v_cutoff := now() - make_interval(months => v_months);

  with base as (
    select
      coalesce(cat.label, 'Sem categoria') as categoria,
      pr.status,
      extract(epoch from (coalesce(pr.updated_at, pr.created_at) - pr.created_at)) / 3600.0 as horas_fluxo
    from public.pastoral_requests pr
    left join public.pastoral_reason_categories cat on cat.id = pr.category_id
    where pr.created_at >= v_cutoff
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'categoria', b.categoria,
        'solicitacoes', b.solicitacoes,
        'horas_medias_fluxo', round(b.horas_medias_fluxo::numeric, 2)
      )
      order by b.solicitacoes desc
    ), '[]'::jsonb),
    jsonb_build_object(
      'semestre_meses', v_months,
      'total_solicitacoes', (select count(*) from base)
    )
  into v_rows, v_summary
  from (
    select
      categoria,
      count(*)::int as solicitacoes,
      avg(horas_fluxo) as horas_medias_fluxo
    from base
    group by categoria
  ) b;

  return public._maintenance_report_payload(
    'pastoral_needs',
    array['categoria', 'solicitacoes', 'horas_medias_fluxo'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_volunteer_engagement(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_threshold integer;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_month := public._parse_report_month(p_params->>'referencia_mes');
  v_threshold := greatest(1, least(coalesce((p_params->>'overload_threshold')::int, 5), 20));

  with month_bounds as (
    select
      v_month as month_start,
      (v_month + interval '1 month - 1 day')::date as month_end
  ),
  counts as (
    select
      ve.nome as voluntario,
      te.nome as tipo_escala,
      count(el.id)::int as escalas_no_mes
    from public.escalas_log el
    join public.voluntarios_escala ve on ve.id = el.voluntario_id
    join public.tipos_escala te on te.id = el.tipo_escala_id
    cross join month_bounds b
    where el.data_servico between b.month_start and b.month_end
    group by ve.nome, te.nome
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'voluntario', c.voluntario,
        'tipo_escala', c.tipo_escala,
        'escalas_no_mes', c.escalas_no_mes,
        'sobrecarga', case when c.escalas_no_mes >= v_threshold then 'Sim' else 'Não' end
      )
      order by c.escalas_no_mes desc, c.voluntario
    ), '[]'::jsonb),
    jsonb_build_object(
      'mes_referencia', to_char(v_month, 'YYYY-MM'),
      'limite_sobrecarga', v_threshold,
      'servos_sobrecarregados', (select count(*) from counts where escalas_no_mes >= v_threshold),
      'tipos_com_poucos_voluntarios', (
        select count(*)
          from public.tipos_escala te
         where (select count(*) from public.voluntarios_escala ve where ve.tipo_escala_id = te.id) < 3
      )
    )
  into v_rows, v_summary
  from counts c;

  return public._maintenance_report_payload(
    'volunteer_engagement',
    array['voluntario', 'tipo_escala', 'escalas_no_mes', 'sobrecarga'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_digital_adoption(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_cutoff timestamptz;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_days := greatest(7, least(coalesce((p_params->>'days')::int, 30), 180));
  v_cutoff := now() - make_interval(days => v_days);

  with screens as (
    select
      coalesce(nullif(trim(sv.screen_key), ''), 'desconhecida') as rota,
      coalesce(nullif(trim(sv.screen_label), ''), sv.screen_key, 'desconhecida') as rotulo,
      count(*)::int as visitas
    from public.profile_app_access_screen_visits sv
    join public.profile_app_access_events ev on ev.id = sv.access_event_id
    where ev.accessed_at >= v_cutoff
    group by 1, 2
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'rota', s.rota,
        'rotulo', s.rotulo,
        'visitas', s.visitas
      )
      order by s.visitas desc
    ), '[]'::jsonb),
    jsonb_build_object(
      'dias_analisados', v_days,
      'sessoes', (select count(*) from public.profile_app_access_events where accessed_at >= v_cutoff),
      'inscricoes_eventos', (select count(*) from public.event_registrations where created_at >= v_cutoff)
    )
  into v_rows, v_summary
  from screens s;

  return public._maintenance_report_payload(
    'digital_adoption',
    array['rota', 'rotulo', 'visitas'],
    v_rows,
    v_summary
  );
end;
$$;

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
      p.id,
      coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as nome,
      p.birth_date,
      public.resolve_basic_role_code_for_profile(p.id) as role_code
    from public.profiles p
    cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
    where coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
      and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
      and coalesce(eff.membership_out::text, '') = ''
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

create or replace function public._report_demographic_family_size(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
begin
  with profiles_base as (
    select
      coalesce(nullif(trim(p.family_id), ''), '(sem família)') as familia
    from public.profiles p
    where coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
  ),
  family_sizes as (
    select
      familia,
      count(*)::int as integrantes
    from profiles_base
    group by familia
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'familia', f.familia,
        'integrantes', f.integrantes,
        'classificacao', case
          when f.integrantes = 1 then 'Individual'
          when f.integrantes between 2 and 3 then 'Família pequena'
          else 'Família grande'
        end
      )
      order by f.integrantes desc, f.familia asc
    ), '[]'::jsonb),
    jsonb_build_object(
      'perfis_analisados', (select count(*) from profiles_base),
      'familias_distintas', (select count(*) from family_sizes),
      'media_integrantes', round((select avg(integrantes)::numeric from family_sizes), 2)
    )
  into v_rows, v_summary
  from family_sizes f;

  return public._maintenance_report_payload(
    'demographic_family_size',
    array['familia', 'integrantes', 'classificacao'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_health_alerts(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_rows jsonb;
  v_summary jsonb;
begin
  if nullif(btrim(coalesce(p_params->>'event_id', '')), '') is not null then
    v_event_id := (p_params->>'event_id')::uuid;
  end if;

  if v_event_id is null then
    select e.id
      into v_event_id
      from public.events e
     where exists (select 1 from public.event_registrations er where er.event_id = e.id)
     order by e.event_date desc nulls last
     limit 1;
  end if;

  with base as (
    select
      coalesce(nullif(trim(p.full_name), ''), '(sem nome)') as nome,
      coalesce(nullif(trim(p.medical_food_alerts), ''), 'Sem alerta') as alertas,
      e.name as evento
    from public.event_registrations er
    join public.profiles p on p.id = er.profile_id
    join public.events e on e.id = er.event_id
    where er.event_id = v_event_id
      and nullif(trim(coalesce(p.medical_food_alerts, '')), '') is not null
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'nome', b.nome,
        'alertas', b.alertas,
        'evento', b.evento
      )
      order by b.nome
    ), '[]'::jsonb),
    jsonb_build_object(
      'evento', (
        select
          coalesce(nullif(trim(e.name), ''), 'Evento sem nome')
          || case
            when e.event_date is not null then ' — ' || to_char(e.event_date::date, 'DD/MM/YYYY')
            else ''
          end
        from public.events e
        where e.id = v_event_id
      ),
      'criancas_com_alerta', (select count(*) from base)
    )
  into v_rows, v_summary
  from base b;

  return public._maintenance_report_payload(
    'health_alerts',
    array['nome', 'alertas', 'evento'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_checkin_adoption(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_month := public._parse_report_month(p_params->>'referencia_mes');

  with bounds as (
    select
      v_month as month_start,
      (v_month + interval '1 month - 1 day')::date as month_end
  ),
  base as (
    select
      case
        when c.geo_confirmed_at is not null or c.geo_latitude is not null then 'GPS (Geofence)'
        else 'Totem'
      end as origem
    from public.checkins c
    cross join bounds b
    where c.status = 'confirmado'
      and coalesce(c.timestamp_confirmacao, c.created_at)::date between b.month_start and b.month_end
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'origem', b.origem,
        'quantidade', b.quantidade,
        'percentual', round(100.0 * b.quantidade / nullif((select count(*) from base), 0), 1)
      )
      order by b.quantidade desc
    ), '[]'::jsonb),
    jsonb_build_object(
      'mes_referencia', to_char(v_month, 'YYYY-MM'),
      'total_confirmados', (select count(*) from base)
    )
  into v_rows, v_summary
  from (
    select origem, count(*)::int as quantidade
    from base
    group by origem
  ) b;

  return public._maintenance_report_payload(
    'checkin_adoption',
    array['origem', 'quantidade', 'percentual'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_quorum_official(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
begin
  with base as (
    select
      e.name as evento,
      e.event_date,
      coalesce(nullif(trim(p.full_name), ''), '(sem nome)') as nome,
      c.status,
      c.timestamp_confirmacao
    from public.events e
    join public.checkins c on c.event_id = e.id
    join public.profiles p on p.id = c.profile_id
    where coalesce(e.requer_quorum, false) = true
      and coalesce(e.is_locked, false) = true
      and c.status = 'confirmado'
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'evento', b.evento,
        'data_evento', b.event_date,
        'nome', b.nome,
        'status', b.status,
        'hora_checkin', b.timestamp_confirmacao
      )
      order by b.event_date desc, b.nome
    ), '[]'::jsonb),
    jsonb_build_object(
      'eventos_quorum_encerrados', (select count(distinct evento) from base),
      'presentes_confirmados', (select count(*) from base)
    )
  into v_rows, v_summary
  from base b;

  return public._maintenance_report_payload(
    'quorum_official',
    array['evento', 'data_evento', 'nome', 'status', 'hora_checkin'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_treasury_sla(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_month := public._parse_report_month(p_params->>'referencia_mes');

  with bounds as (
    select
      v_month as month_start,
      (v_month + interval '1 month - 1 day')::date as month_end
  ),
  base as (
    select
      er.report_number,
      er.status,
      er.created_at,
      er.updated_at,
      extract(epoch from (er.updated_at - er.created_at)) / 86400.0 as dias_ate_conciliacao
    from public.expense_reports er
    cross join bounds b
    where er.created_at::date between b.month_start and b.month_end
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'rd', b.report_number,
        'status', b.status,
        'criado_em', b.created_at,
        'atualizado_em', b.updated_at,
        'dias_ate_conciliacao', round(b.dias_ate_conciliacao::numeric, 2)
      )
      order by b.created_at desc
    ), '[]'::jsonb),
    jsonb_build_object(
      'mes_referencia', to_char(v_month, 'YYYY-MM'),
      'media_dias_conciliacao', round((select avg(dias_ate_conciliacao) from base where status = 'reconciled')::numeric, 2),
      'pendentes', (select count(*) from base where status = 'pending')
    )
  into v_rows, v_summary
  from base b;

  return public._maintenance_report_payload(
    'treasury_sla',
    array['rd', 'status', 'criado_em', 'atualizado_em', 'dias_ate_conciliacao'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_parking_estimate(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_rows jsonb;
  v_summary jsonb;
begin
  if nullif(btrim(coalesce(p_params->>'event_id', '')), '') is null then
    return jsonb_build_object(
      'success', false,
      'report_code', 'parking_estimate',
      'message', 'Informe o ID do evento para estimar o estacionamento.'
    );
  end if;

  v_event_id := (p_params->>'event_id')::uuid;

  with families as (
    select distinct
      upper(trim(er.family_id)) as family_id,
      count(distinct er.profile_id)::int as inscritos
    from public.event_registrations er
    where er.event_id = v_event_id
    group by upper(trim(er.family_id))
  ),
  vehicles as (
    select
      f.family_id,
      f.inscritos,
      count(distinct pv.placa)::int as veiculos_cadastrados
    from families f
    left join public.profiles p on upper(trim(coalesce(p.family_id, ''))) = f.family_id
    left join public.profile_vehicles pv
      on public.format_phone_like_profiles(pv.phone) = public.format_phone_like_profiles(p.phone)
    group by f.family_id, f.inscritos
  ),
  estimated as (
    select
      family_id,
      inscritos,
      veiculos_cadastrados,
      greatest(veiculos_cadastrados, case when inscritos > 0 then 1 else 0 end) as estimativa_veiculos
    from vehicles
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'familia', e.family_id,
        'inscritos', e.inscritos,
        'veiculos_cadastrados', e.veiculos_cadastrados,
        'estimativa_veiculos', e.estimativa_veiculos
      )
      order by e.estimativa_veiculos desc, e.family_id
    ), '[]'::jsonb),
    jsonb_build_object(
      'evento', (
        select
          coalesce(nullif(trim(e.name), ''), 'Evento sem nome')
          || case
            when e.event_date is not null then ' — ' || to_char(e.event_date::date, 'DD/MM/YYYY')
            else ''
          end
        from public.events e
        where e.id = v_event_id
      ),
      'familias_inscritas', (select count(*) from families),
      'estimativa_total_veiculos', (select coalesce(sum(estimativa_veiculos), 0) from estimated)
    )
  into v_rows, v_summary
  from estimated e;

  return public._maintenance_report_payload(
    'parking_estimate',
    array['familia', 'inscritos', 'veiculos_cadastrados', 'estimativa_veiculos'],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_support_suggestions(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
  v_table_exists boolean;
begin
  select exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'maintenance_support_requests'
  )
    into v_table_exists;

  if not v_table_exists then
    return jsonb_build_object(
      'success', false,
      'report_code', 'support_suggestions',
      'message', 'Execute no Supabase: scripts/maintenance-support-suggestions.sql'
    );
  end if;

  with base_requests as (
    select
      r.id,
      r.requester_name,
      r.requester_phone,
      r.record_type,
      r.description,
      r.status,
      r.developer_action,
      r.developer_guidance,
      r.estimated_completion_date,
      r.whatsapp_authorized,
      r.notify_in_app,
      r.created_at,
      r.updated_at,
      r.responded_at,
      coalesce(nullif(trim(t.titulo), ''), '') as tema
    from public.maintenance_support_requests r
    left join public.maintenance_support_themes t on t.id = r.tema_id
  ),
  attachment_summary as (
    select
      a.request_id,
      count(*)::int as anexos_qtd,
      coalesce(
        jsonb_agg(
          coalesce(nullif(trim(a.file_name), ''), 'imagem')
          order by a.sort_order, a.created_at
        ),
        '[]'::jsonb
      ) as anexos_nomes
    from public.maintenance_support_attachments a
    where a.is_active = true
    group by a.request_id
  ),
  all_events as (
    select
      br.id as request_id,
      br.created_at as data_hora,
      'Abertura'::text as tipo,
      'App'::text as canal,
      br.requester_name as autor,
      'Usuário'::text as papel,
      br.description as mensagem
    from base_requests br

    union all

    select
      br.id,
      i.created_at,
      case i.channel::text
        when 'status' then 'Tratamento'
        when 'attachment' then 'Anexo'
        else 'Interação'
      end,
      case i.channel::text
        when 'app' then 'App'
        when 'whatsapp' then 'WhatsApp'
        when 'status' then 'Status'
        when 'attachment' then 'Anexo'
        else i.channel::text
      end,
      i.actor_name,
      case i.actor_role::text
        when 'user' then 'Usuário'
        when 'developer' then 'Desenvolvedor'
        when 'system' then 'Sistema'
        else i.actor_role::text
      end,
      i.message
    from public.maintenance_support_interactions i
    join base_requests br on br.id = i.request_id

    union all

    select
      br.id,
      c.sent_at,
      'Comunicação',
      case c.channel::text
        when 'in_app' then 'Notificação no app'
        when 'whatsapp' then 'WhatsApp'
        else c.channel::text
      end,
      coalesce(nullif(trim(p.full_name), ''), 'Desenvolvedor'),
      'Desenvolvedor',
      trim(
        both E'\n'
        from concat_ws(
          E'\n\n',
          nullif(trim(coalesce(c.subject, '')), ''),
          nullif(trim(c.message), '')
        )
      )
    from public.maintenance_support_communications c
    join base_requests br on br.id = c.request_id
    left join public.profiles p on p.id = c.sent_by_profile_id
  ),
  historico_by_request as (
    select
      e.request_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'data_hora', e.data_hora,
            'tipo', e.tipo,
            'canal', e.canal,
            'autor', e.autor,
            'papel', e.papel,
            'mensagem', e.mensagem
          )
          order by e.data_hora asc, e.tipo asc
        ),
        '[]'::jsonb
      ) as historico
    from all_events e
    group by e.request_id
  ),
  requests_enriched as (
    select
      br.requester_name as solicitante,
      coalesce(nullif(trim(br.requester_phone), ''), '') as telefone,
      case br.record_type::text
        when 'suggestion' then 'Sugestão'
        when 'question' then 'Dúvida'
        when 'comment' then 'Comentário'
        when 'incident' then 'Problema/Incidente'
        else br.record_type::text
      end as tipo,
      br.tema,
      case br.status::text
        when 'received' then 'Recebida'
        when 'in_review' then 'Em análise'
        when 'in_development' then 'Em desenvolvimento'
        when 'awaiting_validation' then 'Aguardando validação'
        when 'completed' then 'Concluída'
        when 'not_applicable' then 'Não aplicável'
        else br.status::text
      end as status,
      br.created_at as abertura_em,
      br.updated_at as atualizado_em,
      br.responded_at as respondido_em,
      br.description as descricao,
      br.developer_action as acao_desenvolvedor,
      br.developer_guidance as orientacoes,
      to_char(br.estimated_completion_date, 'DD/MM/YYYY') as previsao_conclusao,
      coalesce(asum.anexos_qtd, 0) as anexos,
      coalesce(asum.anexos_nomes, '[]'::jsonb) as anexos_nomes,
      br.whatsapp_authorized as whatsapp_autorizado,
      br.notify_in_app as notificar_app,
      coalesce(h.historico, '[]'::jsonb) as historico
    from base_requests br
    left join attachment_summary asum on asum.request_id = br.id
    left join historico_by_request h on h.request_id = br.id
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'solicitante', re.solicitante,
          'telefone', re.telefone,
          'tipo', re.tipo,
          'tema', re.tema,
          'status', re.status,
          'abertura_em', re.abertura_em,
          'atualizado_em', re.atualizado_em,
          'respondido_em', re.respondido_em,
          'descricao', re.descricao,
          'acao_desenvolvedor', re.acao_desenvolvedor,
          'orientacoes', re.orientacoes,
          'previsao_conclusao', re.previsao_conclusao,
          'anexos', re.anexos,
          'anexos_nomes', re.anexos_nomes,
          'whatsapp_autorizado', re.whatsapp_autorizado,
          'notificar_app', re.notificar_app,
          'historico', re.historico
        )
        order by re.abertura_em asc
      ),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'total_solicitacoes', (select count(*) from base_requests),
      'interacoes', (select count(*) from public.maintenance_support_interactions),
      'comunicacoes', (select count(*) from public.maintenance_support_communications),
      'eventos_historico', (select count(*) from all_events)
    )
  into v_rows, v_summary
  from requests_enriched re;

  return public._maintenance_report_payload(
    'support_suggestions',
    array[
      'solicitante',
      'telefone',
      'tipo',
      'tema',
      'status',
      'abertura_em',
      'atualizado_em',
      'respondido_em',
      'descricao',
      'acao_desenvolvedor',
      'orientacoes',
      'previsao_conclusao',
      'anexos',
      'anexos_nomes',
      'whatsapp_autorizado',
      'notificar_app',
      'historico'
    ],
    v_rows,
    v_summary
  );
end;
$$;

create or replace function public._report_event_registrations(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
begin
  with registrants as (
    select
      er.event_id,
      coalesce(nullif(trim(er.family_id), ''), '(sem família)') as familia,
      public.resolve_basic_role_code_for_profile(er.profile_id) as papel_code,
      coalesce(nullif(trim(er.full_name), ''), '(sem nome)') as nome
    from public.event_registrations er
  ),
  registrants_enriched as (
    select
      r.event_id,
      r.familia,
      case r.papel_code
        when 'member' then 'Membro'
        when 'congregado' then 'Congregado'
        when 'visitante' then 'Visitante'
        else coalesce(r.papel_code, '—')
      end as papel,
      r.nome,
      case r.papel_code
        when 'member' then 1
        when 'congregado' then 2
        when 'visitante' then 3
        else 4
      end as papel_ordem
    from registrants r
  ),
  registrants_by_event as (
    select
      re.event_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'familia', re.familia,
            'papel', re.papel,
            'nome', re.nome
          )
          order by re.familia asc, re.papel_ordem asc, re.nome asc
        ),
        '[]'::jsonb
      ) as participantes
    from registrants_enriched re
    group by re.event_id
  ),
  events_enriched as (
    select
      e.id as event_id,
      coalesce(nullif(trim(e.name), ''), '(sem nome)') as evento,
      e.event_date as data,
      count(er.id)::int as inscritos,
      coalesce(rb.participantes, '[]'::jsonb) as participantes
    from public.events e
    join public.event_registrations er on er.event_id = e.id
    left join registrants_by_event rb on rb.event_id = e.id
    group by e.id, e.name, e.event_date, rb.participantes
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'event_id', ee.event_id,
          'evento', ee.evento,
          'data', ee.data,
          'inscritos', ee.inscritos,
          'participantes', ee.participantes
        )
        order by ee.data desc, ee.evento asc
      ),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'total_eventos', (select count(*) from events_enriched),
      'total_inscricoes', (select coalesce(sum(inscritos), 0) from events_enriched)
    )
  into v_rows, v_summary
  from events_enriched ee;

  return public._maintenance_report_payload(
    'event_registrations',
    array['evento', 'data', 'inscritos'],
    v_rows,
    v_summary
  );
end;
$$;

drop function if exists public.gerar_relatorio_manutencao(uuid, text, jsonb);

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

grant execute on function public.gerar_relatorio_manutencao(uuid, text, jsonb) to anon, authenticated;
