-- Relatórios 1 e 2: consulta em conjunto para não estourar os 20s do cliente.
-- Causa: cada perfil chamava resolve_basic_role_code_for_profile +
-- resolve_effective_membership_dates_for_profile (e EXISTS de check-in/acesso).
-- Na IBS (~480 cadastros) a RPC passava de 20s e o fetch abortava
-- ("Não foi possível gerar o relatório.").

create or replace function public._report_members_active_inactive(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_months integer;
  v_cutoff timestamptz;
  v_rows jsonb;
  v_summary jsonb;
begin
  v_months := greatest(1, least(coalesce((p_params->>'inactive_months')::int, 3), 24));
  v_cutoff := now() - make_interval(months => v_months);

  with basic_roles as (
    select
      par.profile_id,
      case
        when bool_or(ar.code = 'member') then 'member'
        when bool_or(ar.code = 'congregado') then 'congregado'
        else 'visitante'
      end as role_code
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
    join public.profiles p on p.id = par.profile_id and p.tenant_id = v_tenant
    where ar.code in ('member', 'congregado')
    group by par.profile_id
  ),
  family_guardians as (
    select distinct on (upper(nullif(trim(gp.family_id), '')))
      upper(nullif(trim(gp.family_id), '')) as family_id,
      gp.id as guardian_id,
      gp.membership_out
    from public.profiles gp
    join basic_roles br on br.profile_id = gp.id and br.role_code = 'member'
    where gp.tenant_id = v_tenant
      and nullif(trim(gp.family_id), '') is not null
    order by upper(nullif(trim(gp.family_id), '')), gp.full_name
  ),
  recent as (
    select e.profile_id
      from public.profile_app_access_events e
     where e.tenant_id = v_tenant
       and e.accessed_at >= v_cutoff
    union
    select c.profile_id
      from public.checkins c
     where c.tenant_id = v_tenant
       and coalesce(c.timestamp_confirmacao, c.created_at) >= v_cutoff
  ),
  activity as (
    select
      p.id,
      coalesce(nullif(trim(p.full_name), ''), '(sem nome)') as full_name,
      coalesce(br.role_code, 'visitante') as role_code,
      greatest(0, coalesce(current_date - p.created_at::date, 0)) as congregation_days,
      case
        when coalesce(br.role_code, 'visitante') = 'congregado'
          and g.guardian_id is not null
          and g.guardian_id <> p.id
          then g.membership_out
        else p.membership_out
      end as effective_membership_out,
      exists (select 1 from recent rec where rec.profile_id = p.id) as has_recent_activity
    from public.profiles p
    left join basic_roles br on br.profile_id = p.id
    left join family_guardians g
      on g.family_id = upper(nullif(trim(p.family_id), ''))
    where p.tenant_id = v_tenant
      and coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
  ),
  classified as (
    select
      a.*,
      case
        when a.role_code in ('member', 'congregado') then
          coalesce(a.effective_membership_out::text, '') = ''
        else
          a.has_recent_activity
      end as is_active
    from activity a
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'nome', c.full_name,
        'papel', c.role_code,
        'dias_congregacao', c.congregation_days,
        'status', case when c.is_active then 'Ativo' else 'Inativo' end
      )
      order by
        case when c.is_active then 0 else 1 end,
        case c.role_code
          when 'member' then 1
          when 'congregado' then 2
          when 'visitante' then 3
          else 4
        end,
        c.full_name
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
  from classified c;

  return public._maintenance_report_payload(
    'members_active_inactive',
    array['nome', 'papel', 'dias_congregacao', 'status'],
    v_rows,
    v_summary
  );
end;
$$;

grant execute on function public._report_members_active_inactive(jsonb) to anon;
grant execute on function public._report_members_active_inactive(jsonb) to authenticated;

create or replace function public._report_active_members_age_matrix(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
  v_summary jsonb;
begin
  with basic_roles as (
    select
      par.profile_id,
      case
        when bool_or(ar.code = 'member') then 'member'
        when bool_or(ar.code = 'congregado') then 'congregado'
        else 'visitante'
      end as role_code
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
    join public.profiles p on p.id = par.profile_id and p.tenant_id = v_tenant
    where ar.code in ('member', 'congregado')
    group by par.profile_id
  ),
  family_guardians as (
    select distinct on (upper(nullif(trim(gp.family_id), '')))
      upper(nullif(trim(gp.family_id), '')) as family_id,
      gp.id as guardian_id,
      gp.membership_out
    from public.profiles gp
    join basic_roles br on br.profile_id = gp.id and br.role_code = 'member'
    where gp.tenant_id = v_tenant
      and nullif(trim(gp.family_id), '') is not null
    order by upper(nullif(trim(gp.family_id), '')), gp.full_name
  ),
  ativos as (
    select
      br.role_code,
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
    join basic_roles br on br.profile_id = p.id
    left join family_guardians g
      on g.family_id = upper(nullif(trim(p.family_id), ''))
    where p.tenant_id = v_tenant
      and coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(p.phone), ''),
        nullif(trim(p.codigo_membro), '')
      ) is not null
      and coalesce(p.codigo_membro, '') not ilike 'TstMax%'
      and br.role_code in ('member', 'congregado')
      and coalesce(
        (
          case
            when br.role_code = 'congregado'
              and g.guardian_id is not null
              and g.guardian_id <> p.id
              then g.membership_out
            else p.membership_out
          end
        )::text,
        ''
      ) = ''
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

grant execute on function public._report_active_members_age_matrix(jsonb) to anon;
grant execute on function public._report_active_members_age_matrix(jsonb) to authenticated;

notify pgrst, 'reload schema';
