-- =============================================================================
-- Trilha de Discipulado — selos (badges) + alertas pastorais de conclusão
-- =============================================================================
-- Pré-requisito: scripts/discipleship-trail-schema.sql
--
-- Ao concluir 100% de um módulo → grava selo em user_discipleship_badges
-- Ao concluir a última lição da trilha → notifica o painel pastoral
--   (discipleship_pastoral_alerts) para certificado / reconhecimento público
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Selos / conquistas por módulo
-- ---------------------------------------------------------------------------

create table if not exists public.user_discipleship_badges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid null references public.discipleship_modules (id) on delete cascade,
  badge_code text not null,
  badge_title text not null,
  badge_description text null,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_discipleship_badges_code_check
    check (badge_code in ('module_complete', 'trail_complete')),
  constraint user_discipleship_badges_module_required
    check (
      (badge_code = 'module_complete' and module_id is not null)
      or (badge_code = 'trail_complete' and module_id is null)
    )
);

create unique index if not exists user_discipleship_badges_module_unique
  on public.user_discipleship_badges (tenant_id, profile_id, module_id)
  where badge_code = 'module_complete';

create unique index if not exists user_discipleship_badges_trail_unique
  on public.user_discipleship_badges (tenant_id, profile_id)
  where badge_code = 'trail_complete';

create index if not exists user_discipleship_badges_tenant_idx
  on public.user_discipleship_badges (tenant_id);

create index if not exists user_discipleship_badges_profile_idx
  on public.user_discipleship_badges (profile_id);

comment on table public.user_discipleship_badges is
  'Selos desbloqueados ao concluir módulos ou a trilha inteira.';

-- ---------------------------------------------------------------------------
-- 2) Notificações do painel pastoral (reconhecimento / certificado)
-- ---------------------------------------------------------------------------

create table if not exists public.discipleship_pastoral_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  alert_type text not null default 'trail_complete_certificate',
  title text not null,
  message text not null,
  status text not null default 'new',
  acknowledged_at timestamptz null,
  acknowledged_by_profile_id uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipleship_pastoral_alerts_type_check
    check (alert_type in ('trail_complete_certificate')),
  constraint discipleship_pastoral_alerts_status_check
    check (status in ('new', 'acknowledged', 'closed'))
);

create unique index if not exists discipleship_pastoral_alerts_trail_unique
  on public.discipleship_pastoral_alerts (tenant_id, profile_id, alert_type);

create index if not exists discipleship_pastoral_alerts_tenant_status_idx
  on public.discipleship_pastoral_alerts (tenant_id, status, created_at desc);

comment on table public.discipleship_pastoral_alerts is
  'Fila do painel pastoral: aluno pronto para certificado / reconhecimento público.';

drop trigger if exists trg_discipleship_pastoral_alerts_updated_at
  on public.discipleship_pastoral_alerts;
create trigger trg_discipleship_pastoral_alerts_updated_at
  before update on public.discipleship_pastoral_alerts
  for each row
  execute function public.set_updated_at_discipleship();

do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'tg_set_tenant_id_from_session'
  ) then
    drop trigger if exists trg_user_discipleship_badges_tenant
      on public.user_discipleship_badges;
    create trigger trg_user_discipleship_badges_tenant
      before insert on public.user_discipleship_badges
      for each row
      execute function public.tg_set_tenant_id_from_session();

    drop trigger if exists trg_discipleship_pastoral_alerts_tenant
      on public.discipleship_pastoral_alerts;
    create trigger trg_discipleship_pastoral_alerts_tenant
      before insert on public.discipleship_pastoral_alerts
      for each row
      execute function public.tg_set_tenant_id_from_session();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Avaliar conquistas + notificar pastoral
-- ---------------------------------------------------------------------------

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
  v_new_module_badge boolean := false;
  v_new_trail_badge boolean := false;
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

  -- Selo do módulo (se a lição concluída pertence a um módulo 100%)
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

      with ins as (
        insert into public.user_discipleship_badges (
          tenant_id, profile_id, module_id, badge_code, badge_title, badge_description
        ) values (
          p_tenant_id,
          p_profile_id,
          v_module_id,
          'module_complete',
          'Selo: ' || v_badge_title,
          'Módulo concluído com 100% das lições.'
        )
        on conflict (tenant_id, profile_id, module_id)
          where (badge_code = 'module_complete')
          do nothing
        returning id
      )
      select exists (select 1 from ins) into v_new_module_badge;
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
    with ins as (
      insert into public.user_discipleship_badges (
        tenant_id, profile_id, module_id, badge_code, badge_title, badge_description
      ) values (
        p_tenant_id,
        p_profile_id,
        null,
        'trail_complete',
        'Trilha de Discipulado Concluída',
        'Todas as lições ativas da trilha foram concluídas.'
      )
      on conflict (tenant_id, profile_id)
        where (badge_code = 'trail_complete')
        do nothing
      returning id
    )
    select exists (select 1 from ins) into v_new_trail_badge;

    select coalesce(nullif(trim(p.full_name), ''), 'Um membro')
      into v_member_name
      from public.profiles p
     where p.id = p_profile_id;

    with ins as (
      insert into public.discipleship_pastoral_alerts (
        tenant_id,
        profile_id,
        alert_type,
        title,
        message,
        status
      ) values (
        p_tenant_id,
        p_profile_id,
        'trail_complete_certificate',
        'Pronto para reconhecimento / certificado',
        v_member_name
          || ' concluiu 100% da Trilha de Discipulado e está pronto(a) para a entrega do certificado '
          || 'ou reconhecimento público na igreja.',
        'new'
      )
      on conflict (tenant_id, profile_id, alert_type)
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
    'new_pastoral_alert', v_new_pastoral_alert,
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
  'Concede selos de módulo/trilha e cria alerta pastoral ao concluir a trilha.';

grant execute on function public.evaluate_discipleship_achievements(uuid, uuid, uuid)
  to anon, authenticated, service_role;

-- Trigger: após progresso concluído
create or replace function public.tg_discipleship_progress_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform public.evaluate_discipleship_achievements(
      new.tenant_id,
      new.profile_id,
      new.lesson_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_discipleship_progress_achievements
  on public.user_discipleship_progress;
create trigger trg_discipleship_progress_achievements
  after insert or update of status
  on public.user_discipleship_progress
  for each row
  execute function public.tg_discipleship_progress_achievements();

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------

alter table public.user_discipleship_badges enable row level security;
alter table public.discipleship_pastoral_alerts enable row level security;

drop policy if exists user_discipleship_badges_select on public.user_discipleship_badges;
create policy user_discipleship_badges_select
  on public.user_discipleship_badges
  for select
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and (
      profile_id = public.current_session_profile_id()
      or public.can_manage_discipleship_trail(public.current_session_profile_id())
    )
  );

-- Inserts via trigger/SECURITY DEFINER; bloqueia insert direto de membros
drop policy if exists user_discipleship_badges_insert_manage on public.user_discipleship_badges;
create policy user_discipleship_badges_insert_manage
  on public.user_discipleship_badges
  for insert
  with check (
    public.can_manage_discipleship_trail(public.current_session_profile_id())
    and (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
  );

drop policy if exists discipleship_pastoral_alerts_select on public.discipleship_pastoral_alerts;
create policy discipleship_pastoral_alerts_select
  on public.discipleship_pastoral_alerts
  for select
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

drop policy if exists discipleship_pastoral_alerts_update on public.discipleship_pastoral_alerts;
create policy discipleship_pastoral_alerts_update
  on public.discipleship_pastoral_alerts
  for update
  using (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  )
  with check (
    (
      public.session_tenant_matches(tenant_id)
      or public.is_super_admin_profile(public.current_session_profile_id())
    )
    and public.can_manage_discipleship_trail(public.current_session_profile_id())
  );

grant select on public.user_discipleship_badges to anon, authenticated;
grant select, update on public.discipleship_pastoral_alerts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) ACL
-- ---------------------------------------------------------------------------

do $$
begin
  insert into public.access_resources (resource_type, resource_key, label, description, is_active)
  values
    (
      'screen',
      '/trilha-discipulado',
      'Trilha de Discipulado',
      'Módulos, lições, progresso e selos do discipulado',
      true
    ),
    (
      'screen',
      'maintenance.card.discipleship_alerts',
      'Trilha — Reconhecimentos',
      'Alertas pastorais de conclusão da Trilha de Discipulado',
      true
    ),
    (
      'table',
      'user_discipleship_badges',
      'Selos da Trilha de Discipulado',
      null,
      true
    ),
    (
      'table',
      'discipleship_pastoral_alerts',
      'Alertas pastorais da Trilha',
      null,
      true
    )
  on conflict (resource_type, resource_key) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = true;

  -- Grants padrão: pastoral + líderes veem o card de reconhecimentos
  insert into public.access_grants (role_id, resource_id, can_view, can_update)
  select r.id, res.id, true, true
    from public.access_roles r
    join public.access_resources res
      on res.resource_type = 'screen'
     and res.resource_key = 'maintenance.card.discipleship_alerts'
   where r.code in ('super_admin', 'pastoral', 'lider', 'lider_geral')
     and not exists (
       select 1
         from public.access_grants g
        where g.role_id = r.id
          and g.resource_id = res.id
     );

  -- Tela do membro: papéis comuns + pastoral
  insert into public.access_grants (role_id, resource_id, can_view, can_update)
  select r.id, res.id, true, true
    from public.access_roles r
    join public.access_resources res
      on res.resource_type = 'screen'
     and res.resource_key = '/trilha-discipulado'
   where r.code in (
     'super_admin', 'pastoral', 'lider', 'lider_geral', 'member', 'membro', 'congregado'
   )
     and not exists (
       select 1
         from public.access_grants g
        where g.role_id = r.id
          and g.resource_id = res.id
     );
exception
  when others then
    raise warning 'ACL discipleship badges/alerts: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

commit;
