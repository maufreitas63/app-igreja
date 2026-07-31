-- =============================================================================
-- Trilha: cores progressivas dos selos + alerta pastoral por módulo
-- Pré-requisito: discipleship-trail-badges-alerts.sql
-- =============================================================================

alter table public.user_discipleship_badges
  add column if not exists badge_color text null;

alter table public.user_discipleship_badges
  add column if not exists step_order integer null;

comment on column public.user_discipleship_badges.badge_color is
  'Cor hex do selo (progressão visual por passo).';
comment on column public.user_discipleship_badges.step_order is
  'Número do passo (1–5) associado ao selo de módulo; 5 também para trilha completa.';

alter table public.discipleship_pastoral_alerts
  add column if not exists module_id uuid null references public.discipleship_modules (id) on delete set null;

alter table public.discipleship_pastoral_alerts
  drop constraint if exists discipleship_pastoral_alerts_type_check;

alter table public.discipleship_pastoral_alerts
  add constraint discipleship_pastoral_alerts_type_check
  check (alert_type in ('trail_complete_certificate', 'module_complete'));

drop index if exists public.discipleship_pastoral_alerts_trail_unique;
create unique index if not exists discipleship_pastoral_alerts_trail_unique
  on public.discipleship_pastoral_alerts (tenant_id, profile_id, alert_type)
  where alert_type = 'trail_complete_certificate';

create unique index if not exists discipleship_pastoral_alerts_module_unique
  on public.discipleship_pastoral_alerts (tenant_id, profile_id, alert_type, module_id)
  where alert_type = 'module_complete' and module_id is not null;

create or replace function public.discipleship_badge_color_for_step(p_sort_order integer)
returns text
language sql
immutable
as $$
  select case coalesce(p_sort_order, 0)
    when 1 then '#0EA5E9' -- Azul céu / turquesa (acolhimento)
    when 2 then '#059669' -- Verde esmeralda (crescimento)
    when 3 then '#1E3A8A' -- Azul royal / profundo (batismo)
    when 4 then '#EA580C' -- Laranja / âmbar (comunhão)
    when 5 then '#C9A227' -- Dourado / bronze (maturidade)
    else '#64748B'
  end;
$$;

comment on function public.discipleship_badge_color_for_step(integer) is
  'Cor hex do selo da Trilha conforme o sort_order do módulo (1–5).';

grant execute on function public.discipleship_badge_color_for_step(integer)
  to anon, authenticated, service_role;

-- Backfill de selos já conquistados
update public.user_discipleship_badges b
   set step_order = m.sort_order,
       badge_color = public.discipleship_badge_color_for_step(m.sort_order)
  from public.discipleship_modules m
 where b.badge_code = 'module_complete'
   and b.module_id = m.id
   and (b.badge_color is null or b.step_order is null);

update public.user_discipleship_badges b
   set step_order = 5,
       badge_color = public.discipleship_badge_color_for_step(5)
 where b.badge_code = 'trail_complete'
   and (b.badge_color is null or b.step_order is null);

create or replace function public.evaluate_discipleship_achievements(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_lesson_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_module_id uuid;
  v_module_title text;
  v_module_order integer;
  v_module_lessons integer;
  v_module_done integer;
  v_trail_lessons integer;
  v_trail_done integer;
  v_member_name text;
  v_badge_color text;
  v_new_module_badge boolean := false;
  v_new_trail_badge boolean := false;
  v_new_module_alert boolean := false;
  v_new_pastoral_alert boolean := false;
  v_badge_title text;
begin
  if p_tenant_id is null or p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'tenant/profile obrigatórios');
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  if p_lesson_id is not null then
    select l.module_id, m.title, m.sort_order
      into v_module_id, v_module_title, v_module_order
      from public.discipleship_lessons l
      join public.discipleship_modules m on m.id = l.module_id
     where l.id = p_lesson_id
       and l.tenant_id = p_tenant_id;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Um membro')
    into v_member_name
    from public.profiles p
   where p.id = p_profile_id;

  -- Selo do módulo (100% das lições ativas)
  if v_module_id is not null then
    select count(*)::integer,
           count(*) filter (
             where exists (
               select 1
                 from public.user_discipleship_progress p
                where p.tenant_id = p_tenant_id
                  and p.profile_id = p_profile_id
                  and p.lesson_id = l.id
                  and p.status = 'completed'
             )
           )::integer
      into v_module_lessons, v_module_done
      from public.discipleship_lessons l
     where l.tenant_id = p_tenant_id
       and l.module_id = v_module_id
       and l.is_active = true;

    if v_module_lessons > 0 and v_module_done = v_module_lessons then
      v_badge_title := coalesce(
        nullif(trim(v_module_title), ''),
        'Módulo ' || coalesce(v_module_order::text, '')
      );
      v_badge_color := public.discipleship_badge_color_for_step(v_module_order);

      with ins as (
        insert into public.user_discipleship_badges (
          tenant_id, profile_id, module_id, badge_code, badge_title, badge_description,
          badge_color, step_order
        ) values (
          p_tenant_id,
          p_profile_id,
          v_module_id,
          'module_complete',
          'Selo: ' || v_badge_title,
          'Passo ' || coalesce(v_module_order::text, '') || ' concluído com 100% das lições.',
          v_badge_color,
          v_module_order
        )
        on conflict (tenant_id, profile_id, module_id)
          where (badge_code = 'module_complete')
          do update set
            badge_color = excluded.badge_color,
            step_order = excluded.step_order,
            badge_title = excluded.badge_title,
            badge_description = excluded.badge_description
        returning (xmax = 0) as inserted
      )
      select coalesce(bool_or(inserted), false) into v_new_module_badge from ins;

      with ins as (
        insert into public.discipleship_pastoral_alerts (
          tenant_id,
          profile_id,
          module_id,
          alert_type,
          title,
          message,
          status
        ) values (
          p_tenant_id,
          p_profile_id,
          v_module_id,
          'module_complete',
          'Passo ' || coalesce(v_module_order::text, '') || ' concluído',
          v_member_name
            || ' concluiu o passo «'
            || v_badge_title
            || '» da Trilha de Discipulado.',
          'new'
        )
        on conflict (tenant_id, profile_id, alert_type, module_id)
          where (alert_type = 'module_complete' and module_id is not null)
          do nothing
        returning id
      )
      select exists (select 1 from ins) into v_new_module_alert;
    end if;
  end if;

  -- Trilha completa?
  select count(*)::integer,
         count(*) filter (
           where exists (
             select 1
               from public.user_discipleship_progress p
              where p.tenant_id = p_tenant_id
                and p.profile_id = p_profile_id
                and p.lesson_id = l.id
                and p.status = 'completed'
             )
           )::integer
    into v_trail_lessons, v_trail_done
    from public.discipleship_lessons l
    join public.discipleship_modules m on m.id = l.module_id
   where l.tenant_id = p_tenant_id
     and l.is_active = true
     and m.is_active = true
     and m.tenant_id = p_tenant_id;

  if v_trail_lessons > 0 and v_trail_done = v_trail_lessons then
    v_badge_color := public.discipleship_badge_color_for_step(5);

    with ins as (
      insert into public.user_discipleship_badges (
        tenant_id, profile_id, module_id, badge_code, badge_title, badge_description,
        badge_color, step_order
      ) values (
        p_tenant_id,
        p_profile_id,
        null,
        'trail_complete',
        'Trilha de Discipulado Concluída',
        'Todas as lições ativas da trilha foram concluídas. Selo dourado de honra.',
        v_badge_color,
        5
      )
      on conflict (tenant_id, profile_id)
        where (badge_code = 'trail_complete')
        do update set
          badge_color = excluded.badge_color,
          step_order = excluded.step_order,
          badge_description = excluded.badge_description
      returning (xmax = 0) as inserted
    )
    select coalesce(bool_or(inserted), false) into v_new_trail_badge from ins;

    with ins as (
      insert into public.discipleship_pastoral_alerts (
        tenant_id,
        profile_id,
        module_id,
        alert_type,
        title,
        message,
        status
      ) values (
        p_tenant_id,
        p_profile_id,
        null,
        'trail_complete_certificate',
        'Pronto para reconhecimento / certificado',
        v_member_name
          || ' concluiu 100% da Trilha de Discipulado e está pronto(a) para a entrega do certificado '
          || 'ou reconhecimento público na igreja.',
        'new'
      )
      on conflict (tenant_id, profile_id, alert_type)
        where (alert_type = 'trail_complete_certificate')
        do nothing
      returning id
    )
    select exists (select 1 from ins) into v_new_pastoral_alert;
  end if;

  return jsonb_build_object(
    'success', true,
    'module_id', v_module_id,
    'module_complete', v_module_lessons > 0 and v_module_done = v_module_lessons,
    'trail_complete', v_trail_lessons > 0 and v_trail_done = v_trail_lessons,
    'new_module_badge', v_new_module_badge,
    'new_trail_badge', v_new_trail_badge,
    'new_module_alert', v_new_module_alert,
    'new_pastoral_alert', v_new_pastoral_alert,
    'badge_color', v_badge_color,
    'module_progress', jsonb_build_object(
      'done', coalesce(v_module_done, 0),
      'total', coalesce(v_module_lessons, 0)
    ),
    'trail_progress', jsonb_build_object(
      'done', coalesce(v_trail_done, 0),
      'total', coalesce(v_trail_lessons, 0)
    )
  );
end;
$$;

comment on function public.evaluate_discipleship_achievements(uuid, uuid, uuid) is
  'Concede selos coloridos por passo, alerta pastoral por módulo e alerta de certificado ao fechar a trilha.';
