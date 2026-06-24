-- RPCs do catálogo de relatórios de manutenção.
-- Pré-requisitos: scripts/maintenance-reports-access.sql
--                 scripts/access-control-pastoral-congregado-membership.sql (datas efetivas)
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
      order by a.full_name
    ), '[]'::jsonb),
    jsonb_build_object(
      'visitantes', count(*) filter (where role_code = 'visitante'),
      'congregados', count(*) filter (where role_code = 'congregado'),
      'membros', count(*) filter (where role_code = 'member' and coalesce(effective_membership_out::text, '') = ''),
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

create or replace function public._report_demographic_family(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
    where coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
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
      'event_id', v_event_id,
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
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'familia', v.family_id,
        'inscritos', v.inscritos,
        'veiculos_cadastrados', v.veiculos_cadastrados,
        'estimativa_veiculos', greatest(v.veiculos_cadastrados, case when v.inscritos > 0 then 1 else 0 end)
      )
      order by v.estimativa_veiculos desc, v.family_id
    ), '[]'::jsonb),
    jsonb_build_object(
      'event_id', v_event_id,
      'familias_inscritas', (select count(*) from families),
      'estimativa_total_veiculos', (select coalesce(sum(greatest(veiculos_cadastrados, case when inscritos > 0 then 1 else 0 end)), 0) from vehicles)
    )
  into v_rows, v_summary
  from vehicles v;

  return public._maintenance_report_payload(
    'parking_estimate',
    array['familia', 'inscritos', 'veiculos_cadastrados', 'estimativa_veiculos'],
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
    when 'financial_flow' then
      return public._report_financial_flow(coalesce(p_params, '{}'::jsonb));
    when 'territory_indicators' then
      return public._report_territory_indicators(coalesce(p_params, '{}'::jsonb));
    when 'attendance_retention' then
      return public._report_attendance_retention(coalesce(p_params, '{}'::jsonb));
    when 'pastoral_needs' then
      return public._report_pastoral_needs(coalesce(p_params, '{}'::jsonb));
    when 'volunteer_engagement' then
      return public._report_volunteer_engagement(coalesce(p_params, '{}'::jsonb));
    when 'digital_adoption' then
      return public._report_digital_adoption(coalesce(p_params, '{}'::jsonb));
    when 'demographic_family' then
      return public._report_demographic_family(coalesce(p_params, '{}'::jsonb));
    when 'health_alerts' then
      return public._report_health_alerts(coalesce(p_params, '{}'::jsonb));
    when 'checkin_adoption' then
      return public._report_checkin_adoption(coalesce(p_params, '{}'::jsonb));
    when 'quorum_official' then
      return public._report_quorum_official(coalesce(p_params, '{}'::jsonb));
    when 'treasury_sla' then
      return public._report_treasury_sla(coalesce(p_params, '{}'::jsonb));
    when 'parking_estimate' then
      return public._report_parking_estimate(coalesce(p_params, '{}'::jsonb));
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
