-- =============================================================================
-- Gestão de Pequenos Grupos (Células) — multi-tenant
-- =============================================================================
-- Tabelas, RPCs SECURITY DEFINER e ACL:
--   dashboard.card.small_group
--   maintenance.card.small_groups_management
-- tenant_id sempre vem da sessão (require_session_tenant_id) — nunca do cliente.
-- Aplica: npx supabase db query --linked -f scripts/small-groups-schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.small_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  name text not null,
  meeting_weekday smallint not null default 3
    check (meeting_weekday between 0 and 6),
  meeting_time time not null default time '19:30',
  host_profile_id uuid null references public.profiles (id) on delete set null,
  leader_profile_id uuid null references public.profiles (id) on delete set null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_profile_id uuid null references public.profiles (id) on delete set null,
  constraint small_groups_name_check check (length(trim(name)) >= 2)
);

create index if not exists small_groups_tenant_idx
  on public.small_groups (tenant_id, is_active);

create index if not exists small_groups_leader_idx
  on public.small_groups (leader_profile_id)
  where leader_profile_id is not null;

create index if not exists small_groups_host_idx
  on public.small_groups (host_profile_id)
  where host_profile_id is not null;

comment on table public.small_groups is
  'Pequenos grupos / células por igreja (tenant_id). Anfitrião e liderança são profiles distintos.';
comment on column public.small_groups.meeting_weekday is
  '0 = domingo … 6 = sábado (mesmo eixo de Date.getDay no JS).';
comment on column public.small_groups.host_profile_id is
  'Anfitrião — endereço/CEP deste perfil posiciona o pin no mapa.';
comment on column public.small_groups.leader_profile_id is
  'Líder do grupo — recebe aviso de ausência e gerencia a chamada.';

create table if not exists public.small_group_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  small_group_id uuid not null references public.small_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint small_group_members_unique unique (small_group_id, profile_id)
);

create unique index if not exists small_group_members_one_group_per_profile
  on public.small_group_members (tenant_id, profile_id);

create index if not exists small_group_members_group_idx
  on public.small_group_members (small_group_id);

create index if not exists small_group_members_profile_idx
  on public.small_group_members (profile_id);

comment on table public.small_group_members is
  'Participantes do pequeno grupo. Um perfil ativo por tenant.';

create table if not exists public.small_group_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  small_group_id uuid not null references public.small_groups (id) on delete cascade,
  meeting_date date not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  present boolean not null default true,
  marked_by_profile_id uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint small_group_attendance_unique unique (small_group_id, meeting_date, profile_id)
);

create index if not exists small_group_attendance_group_date_idx
  on public.small_group_attendance (small_group_id, meeting_date);

comment on table public.small_group_attendance is
  'Chamada manual após a reunião do pequeno grupo.';

alter table public.discipleship_lessons
  add column if not exists is_cell_weekly_guide boolean not null default false;

create unique index if not exists discipleship_lessons_one_cell_guide_per_tenant
  on public.discipleship_lessons (tenant_id)
  where is_cell_weekly_guide is true;

comment on column public.discipleship_lessons.is_cell_weekly_guide is
  'true = lição publicada como roteiro da semana das células neste tenant.';

alter table public.event_avisos
  add column if not exists audience text not null default 'all';

alter table public.event_avisos
  drop constraint if exists event_avisos_audience_check;

alter table public.event_avisos
  add constraint event_avisos_audience_check
  check (audience in ('all', 'small_group_leaders', 'opportunity_match'));

comment on column public.event_avisos.audience is
  'all = todos os membros; small_group_leaders = líderes/anfitriões de células; opportunity_match = só quem casa com a vaga (mural).';

-- ---------------------------------------------------------------------------
-- 2) RLS
-- ---------------------------------------------------------------------------

alter table public.small_groups enable row level security;
alter table public.small_group_members enable row level security;
alter table public.small_group_attendance enable row level security;

drop policy if exists small_groups_tenant_all on public.small_groups;
create policy small_groups_tenant_all
  on public.small_groups
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists small_group_members_tenant_all on public.small_group_members;
create policy small_group_members_tenant_all
  on public.small_group_members
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists small_group_attendance_tenant_all on public.small_group_attendance;
create policy small_group_attendance_tenant_all
  on public.small_group_attendance
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

-- ---------------------------------------------------------------------------
-- 3) Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_small_group_operator(
  p_actor uuid,
  p_group_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if p_actor is null then
    return false;
  end if;

  if public.is_super_admin_profile(p_actor) then
    return true;
  end if;

  if public.profile_has_access(p_actor, 'screen', 'maintenance.card.small_groups_management', 'update')
     or public.profile_has_role_code(p_actor, 'pastoral')
     or public.profile_has_role_code(p_actor, 'lider_geral')
  then
    return true;
  end if;

  if p_group_id is null then
    return public.profile_has_access(
      p_actor, 'screen', 'maintenance.card.small_groups_management', 'view'
    );
  end if;

  v_tenant := public.current_session_tenant_id();

  return exists (
    select 1
      from public.small_groups g
     where g.id = p_group_id
       and g.is_active
       and (v_tenant is null or g.tenant_id = v_tenant)
       and (g.leader_profile_id = p_actor or g.host_profile_id = p_actor)
  );
end;
$$;

create or replace function public.can_admin_small_groups(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_actor is not null
    and (
      public.is_super_admin_profile(p_actor)
      or public.profile_has_access(p_actor, 'screen', 'maintenance.card.small_groups_management', 'update')
      or public.profile_has_role_code(p_actor, 'pastoral')
      or public.profile_has_role_code(p_actor, 'lider_geral')
    ),
    false
  );
$$;

create or replace function public.ensure_small_group_core_members(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_leader uuid;
  v_host uuid;
begin
  select g.tenant_id, g.leader_profile_id, g.host_profile_id
    into v_tenant, v_leader, v_host
    from public.small_groups g
   where g.id = p_group_id;

  if v_tenant is null then
    return;
  end if;

  if v_leader is not null then
    insert into public.small_group_members (tenant_id, small_group_id, profile_id)
    values (v_tenant, p_group_id, v_leader)
    on conflict (small_group_id, profile_id) do nothing;
  end if;

  if v_host is not null then
    insert into public.small_group_members (tenant_id, small_group_id, profile_id)
    values (v_tenant, p_group_id, v_host)
    on conflict (small_group_id, profile_id) do nothing;
  end if;
end;
$$;

create or replace function public.small_group_profile_json(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_profile_id is null then null
    else (
      select jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'phone', p.phone,
        'cep', p.cep,
        'address_street', p.address_street,
        'address_number', p.address_number,
        'address_neighborhood', p.address_neighborhood,
        'address_city', p.address_city,
        'address_state', p.address_state
      )
      from public.profiles p
      where p.id = p_profile_id
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4) RPCs — membro
-- ---------------------------------------------------------------------------

create or replace function public.list_my_small_group()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_group public.small_groups%rowtype;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  select g.*
    into v_group
    from public.small_groups g
   where g.tenant_id = v_tenant
     and g.is_active
     and (
       g.leader_profile_id = v_actor
       or g.host_profile_id = v_actor
       or exists (
         select 1
           from public.small_group_members m
          where m.small_group_id = g.id
            and m.profile_id = v_actor
       )
     )
   order by g.name
   limit 1;

  if v_group.id is null then
    return jsonb_build_object('success', true, 'group', null);
  end if;

  return jsonb_build_object(
    'success', true,
    'group', jsonb_build_object(
      'id', v_group.id,
      'name', v_group.name,
      'meeting_weekday', v_group.meeting_weekday,
      'meeting_time', to_char(v_group.meeting_time, 'HH24:MI'),
      'notes', v_group.notes,
      'is_leader', v_group.leader_profile_id = v_actor,
      'is_host', v_group.host_profile_id = v_actor,
      'host', public.small_group_profile_json(v_group.host_profile_id),
      'leader', public.small_group_profile_json(v_group.leader_profile_id)
    )
  );
end;
$$;

grant execute on function public.list_my_small_group() to anon, authenticated;

create or replace function public.get_current_small_group_guide()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row record;
begin
  select
    l.id,
    l.title,
    l.content,
    l.video_url,
    l.reflection_question,
    m.title as module_title
    into v_row
    from public.discipleship_lessons l
    join public.discipleship_modules m
      on m.id = l.module_id
     and m.tenant_id = v_tenant
   where l.tenant_id = v_tenant
     and l.is_active
     and l.is_cell_weekly_guide
   limit 1;

  if v_row.id is null then
    return jsonb_build_object('success', true, 'guide', null);
  end if;

  return jsonb_build_object(
    'success', true,
    'guide', jsonb_build_object(
      'id', v_row.id,
      'title', v_row.title,
      'content', v_row.content,
      'video_url', v_row.video_url,
      'reflection_question', v_row.reflection_question,
      'module_title', v_row.module_title
    )
  );
end;
$$;

grant execute on function public.get_current_small_group_guide() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) RPCs — gestão
-- ---------------------------------------------------------------------------

create or replace function public.list_small_groups_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_admin boolean;
begin
  if v_actor is null or not public.is_small_group_operator(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'groups', '[]'::jsonb);
  end if;

  v_admin := public.can_admin_small_groups(v_actor);

  return jsonb_build_object(
    'success', true,
    'can_admin', v_admin,
    'groups',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'meeting_weekday', g.meeting_weekday,
            'meeting_time', to_char(g.meeting_time, 'HH24:MI'),
            'notes', g.notes,
            'is_active', g.is_active,
            'host', public.small_group_profile_json(g.host_profile_id),
            'leader', public.small_group_profile_json(g.leader_profile_id),
            'member_count', (
              select count(*)::int
                from public.small_group_members m
               where m.small_group_id = g.id
            )
          )
          order by g.name
        )
        from public.small_groups g
        where g.tenant_id = v_tenant
          and g.is_active
          and (
            v_admin
            or g.leader_profile_id = v_actor
            or g.host_profile_id = v_actor
          )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_small_groups_admin() to anon, authenticated;

create or replace function public.upsert_small_group_admin(
  p_id uuid default null,
  p_name text default null,
  p_meeting_weekday integer default null,
  p_meeting_time text default null,
  p_host_profile_id uuid default null,
  p_leader_profile_id uuid default null,
  p_notes text default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_time time;
begin
  if v_actor is null or not public.can_admin_small_groups(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para cadastrar grupos.');
  end if;

  begin
    v_time := nullif(trim(coalesce(p_meeting_time, '')), '')::time;
  exception
    when others then
      return jsonb_build_object('success', false, 'message', 'Horário inválido. Use HH:MM.');
  end;

  if p_id is null then
    if v_name is null then
      return jsonb_build_object('success', false, 'message', 'Informe o nome do grupo.');
    end if;

    insert into public.small_groups (
      tenant_id, name, meeting_weekday, meeting_time,
      host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id
    ) values (
      v_tenant,
      v_name,
      coalesce(p_meeting_weekday, 3),
      coalesce(v_time, time '19:30'),
      p_host_profile_id,
      p_leader_profile_id,
      nullif(trim(coalesce(p_notes, '')), ''),
      coalesce(p_is_active, true),
      v_actor
    )
    returning id into v_id;
  else
    update public.small_groups g
       set name = coalesce(v_name, g.name),
           meeting_weekday = coalesce(p_meeting_weekday, g.meeting_weekday),
           meeting_time = coalesce(v_time, g.meeting_time),
           host_profile_id = p_host_profile_id,
           leader_profile_id = p_leader_profile_id,
           notes = case when p_notes is null then g.notes else nullif(trim(p_notes), '') end,
           is_active = coalesce(p_is_active, g.is_active),
           updated_at = now()
     where g.id = p_id
       and g.tenant_id = v_tenant
    returning g.id into v_id;

    if v_id is null then
      return jsonb_build_object('success', false, 'message', 'Grupo não encontrado nesta igreja.');
    end if;
  end if;

  perform public.ensure_small_group_core_members(v_id);

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

grant execute on function public.upsert_small_group_admin(
  uuid, text, integer, text, uuid, uuid, text, boolean
) to anon, authenticated;

create or replace function public.search_small_group_profiles(p_query text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  if v_actor is null or not public.is_small_group_operator(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'profiles', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'profiles',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'phone', p.phone
          )
          order by p.full_name
        )
        from (
          select p.id, p.full_name, p.phone
            from public.profiles p
           where p.tenant_id = v_tenant
             and p.membership_out is null
             and (
               public.is_super_admin_profile(v_actor)
               or not public.profile_has_role_code(p.id, 'super_admin')
             )
             and (
               v_q = ''
               or p.full_name ilike '%' || v_q || '%'
               or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
             )
           order by p.full_name
           limit 30
        ) p
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.search_small_group_profiles(text) to anon, authenticated;

create or replace function public.add_small_group_member(
  p_group_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_exists uuid;
begin
  if v_actor is null or not public.can_admin_small_groups(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para incluir membros.');
  end if;

  select g.id into v_exists
    from public.small_groups g
   where g.id = p_group_id
     and g.tenant_id = v_tenant
     and g.is_active;

  if v_exists is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Selecione um membro.');
  end if;

  if exists (
    select 1 from public.small_group_members m
     where m.tenant_id = v_tenant
       and m.profile_id = p_profile_id
       and m.small_group_id <> p_group_id
  ) then
    return jsonb_build_object('success', false, 'message', 'Este perfil já participa de outro pequeno grupo.');
  end if;

  insert into public.small_group_members (tenant_id, small_group_id, profile_id)
  values (v_tenant, p_group_id, p_profile_id)
  on conflict (small_group_id, profile_id) do nothing;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.add_small_group_member(uuid, uuid) to anon, authenticated;

create or replace function public.remove_small_group_member(
  p_group_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.can_admin_small_groups(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para remover membros.');
  end if;

  delete from public.small_group_members m
   where m.small_group_id = p_group_id
     and m.profile_id = p_profile_id
     and m.tenant_id = v_tenant;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.remove_small_group_member(uuid, uuid) to anon, authenticated;

create or replace function public.list_small_group_roll_call(
  p_group_id uuid,
  p_meeting_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.is_small_group_operator(v_actor, p_group_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'members', '[]'::jsonb);
  end if;

  if not exists (
    select 1 from public.small_groups g
     where g.id = p_group_id and g.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.', 'members', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'meeting_date', p_meeting_date,
    'members',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'full_name', p.full_name,
            'phone', p.phone,
            'present', coalesce(a.present, false),
            'badges', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'badge_code', b.badge_code,
                    'badge_title', b.badge_title,
                    'badge_color', b.badge_color,
                    'step_order', b.step_order
                  )
                  order by b.step_order nulls last, b.earned_at
                )
                from public.user_discipleship_badges b
               where b.profile_id = p.id
                 and b.tenant_id = v_tenant
              ),
              '[]'::jsonb
            )
          )
          order by p.full_name
        )
        from public.small_group_members m
        join public.profiles p on p.id = m.profile_id
        left join public.small_group_attendance a
          on a.small_group_id = m.small_group_id
         and a.profile_id = m.profile_id
         and a.meeting_date = p_meeting_date
       where m.small_group_id = p_group_id
         and m.tenant_id = v_tenant
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_small_group_roll_call(uuid, date) to anon, authenticated;

create or replace function public.set_small_group_attendance(
  p_group_id uuid,
  p_meeting_date date,
  p_profile_id uuid,
  p_present boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.is_small_group_operator(v_actor, p_group_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para marcar presença.');
  end if;

  if p_meeting_date is null or p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data e o membro.');
  end if;

  insert into public.small_group_attendance (
    tenant_id, small_group_id, meeting_date, profile_id, present, marked_by_profile_id
  ) values (
    v_tenant, p_group_id, p_meeting_date, p_profile_id, coalesce(p_present, true), v_actor
  )
  on conflict (small_group_id, meeting_date, profile_id) do update
    set present = excluded.present,
        marked_by_profile_id = excluded.marked_by_profile_id,
        updated_at = now();

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.set_small_group_attendance(uuid, date, uuid, boolean)
  to anon, authenticated;

create or replace function public.enqueue_small_group_visitor(
  p_group_id uuid,
  p_full_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone text;
  v_group_name text;
  v_lote uuid;
begin
  if v_actor is null or not public.is_small_group_operator(v_actor, p_group_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para registrar visitante.');
  end if;

  select g.name into v_group_name
    from public.small_groups g
   where g.id = p_group_id
     and g.tenant_id = v_tenant;

  if v_group_name is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.');
  end if;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do visitante.');
  end if;

  if length(v_digits) = 13 and v_digits like '55%' then
    v_digits := substr(v_digits, 3);
  end if;

  if length(v_digits) <> 11 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe um celular com 11 dígitos (DDD + número).'
    );
  end if;

  v_phone := '(' || substr(v_digits, 1, 2) || ') ' || substr(v_digits, 3, 5) || '-' || substr(v_digits, 8, 4);

  insert into public.recepcao_cadastro_familiar_lote (status)
  values ('pending')
  returning id into v_lote;

  insert into public.recepcao_cadastro_familiar (
    submission_id,
    is_informant,
    full_name,
    birth_date,
    phone,
    relationship,
    medical_food_alerts
  ) values (
    v_lote,
    true,
    v_name,
    date '1900-01-01',
    v_phone,
    'Visitante de célula',
    'Origem: pequeno grupo «' || v_group_name || '». Data de nascimento não informada na chamada.'
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Visitante enviado à fila de Recepção Familiar.'
  );
end;
$$;

grant execute on function public.enqueue_small_group_visitor(uuid, text, text)
  to anon, authenticated;

create or replace function public.submit_small_group_spiritual_report(
  p_group_id uuid,
  p_prayer_requests text default null,
  p_pastoral_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_prayer text := nullif(trim(coalesce(p_prayer_requests, '')), '');
  v_notes text := nullif(trim(coalesce(p_pastoral_notes, '')), '');
  v_group_name text;
  v_phone text;
  v_auth uuid;
begin
  if v_actor is null or not public.is_small_group_operator(v_actor, p_group_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para enviar o relatório.');
  end if;

  if v_prayer is null and v_notes is null then
    return jsonb_build_object('success', false, 'message', 'Informe pedidos de oração ou observações pastorais.');
  end if;

  select g.name into v_group_name
    from public.small_groups g
   where g.id = p_group_id
     and g.tenant_id = v_tenant;

  if v_group_name is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.');
  end if;

  select p.phone, p.auth_user_id
    into v_phone, v_auth
    from public.profiles p
   where p.id = v_actor;

  if v_prayer is not null then
    insert into public.pastoral_requests (
      user_id, profile_id, phone, motivo, situacao, description,
      destination_label, confidential, request_for,
      beneficiary_name, beneficiary_details, urgency_level, status
    ) values (
      v_auth,
      v_actor,
      coalesce(nullif(trim(v_phone), ''), 'não informado'),
      'Pedidos de oração — pequeno grupo',
      v_prayer,
      'Relatório da célula «' || v_group_name || '».',
      'Ministério de Intercessão',
      false,
      'third_party',
      v_group_name,
      'Pequeno grupo / célula',
      2,
      'new'
    );
  end if;

  if v_notes is not null then
    insert into public.pastoral_requests (
      user_id, profile_id, phone, motivo, situacao, description,
      destination_label, confidential, request_for,
      beneficiary_name, beneficiary_details, urgency_level, status
    ) values (
      v_auth,
      v_actor,
      coalesce(nullif(trim(v_phone), ''), 'não informado'),
      'Observação pastoral — pequeno grupo',
      v_notes,
      'Relatório da célula «' || v_group_name || '».',
      'Sigilo Pastoral',
      true,
      'third_party',
      v_group_name,
      'Pequeno grupo / célula',
      2,
      'new'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Relatório enviado ao Cuidado Pastoral.'
  );
end;
$$;

grant execute on function public.submit_small_group_spiritual_report(uuid, text, text)
  to anon, authenticated;

create or replace function public.list_small_group_guide_candidates()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.is_small_group_operator(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'lessons', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'lessons',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'title', l.title,
            'module_title', m.title,
            'is_cell_weekly_guide', l.is_cell_weekly_guide
          )
          order by m.sort_order, l.sort_order, l.title
        )
        from public.discipleship_lessons l
        join public.discipleship_modules m
          on m.id = l.module_id
         and m.tenant_id = v_tenant
       where l.tenant_id = v_tenant
         and l.is_active
         and m.is_active
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_small_group_guide_candidates() to anon, authenticated;

create or replace function public.publish_small_group_guide(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
begin
  if v_actor is null or not (
    public.can_admin_small_groups(v_actor)
    or public.can_manage_discipleship_trail(v_actor)
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para publicar o roteiro.');
  end if;

  if p_lesson_id is null then
    update public.discipleship_lessons
       set is_cell_weekly_guide = false,
           updated_at = now()
     where tenant_id = v_tenant
       and is_cell_weekly_guide;

    return jsonb_build_object('success', true, 'message', 'Roteiro da semana removido.');
  end if;

  update public.discipleship_lessons
     set is_cell_weekly_guide = false,
         updated_at = now()
   where tenant_id = v_tenant
     and is_cell_weekly_guide
     and id <> p_lesson_id;

  update public.discipleship_lessons l
     set is_cell_weekly_guide = true,
         updated_at = now()
   where l.id = p_lesson_id
     and l.tenant_id = v_tenant
  returning l.id into v_id;

  if v_id is null then
    return jsonb_build_object('success', false, 'message', 'Lição não encontrada nesta igreja.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Roteiro da semana publicado.');
end;
$$;

grant execute on function public.publish_small_group_guide(uuid) to anon, authenticated;

create or replace function public.list_small_group_map_pins()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return jsonb_build_object(
    'success', true,
    'pins',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'group_id', g.id,
            'group_name', g.name,
            'host_profile_id', g.host_profile_id,
            'meeting_weekday', g.meeting_weekday,
            'meeting_time', to_char(g.meeting_time, 'HH24:MI')
          )
          order by g.name
        )
        from public.small_groups g
       where g.tenant_id = v_tenant
         and g.is_active
         and g.host_profile_id is not null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_small_group_map_pins() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Orquestrador — audiência de líderes de células
-- ---------------------------------------------------------------------------

create or replace function public.listar_event_avisos_publicados()
returns setof public.event_avisos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_is_leader boolean := false;
begin
  if v_actor is not null then
    select exists (
      select 1
        from public.small_groups g
       where g.is_active
         and (v_tenant is null or g.tenant_id = v_tenant)
         and (g.leader_profile_id = v_actor or g.host_profile_id = v_actor)
    ) into v_is_leader;
  end if;

  return query
  select ea.*
    from public.event_avisos ea
   where ea.is_published is true
     and (
       coalesce(ea.audience, 'all') = 'all'
       or (ea.audience = 'small_group_leaders' and v_is_leader)
     )
   order by ea.sort_order asc, ea.updated_at desc;
end;
$$;

grant execute on function public.listar_event_avisos_publicados() to anon, authenticated;

create or replace function public.salvar_event_aviso(
  p_actor_profile_id uuid,
  p_id uuid default null,
  p_title text default '',
  p_body text default '',
  p_sort_order integer default 0,
  p_is_published boolean default true,
  p_audience text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_row public.event_avisos%rowtype;
  v_title text;
  v_body text;
  v_audience text;
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerenciar avisos.');
  end if;

  v_title := trim(coalesce(p_title, ''));
  v_body := trim(coalesce(p_body, ''));
  v_audience := lower(trim(coalesce(p_audience, 'all')));

  if v_body = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o texto do aviso.');
  end if;

  if v_audience not in ('all', 'small_group_leaders', 'opportunity_match') then
    v_audience := 'all';
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  insert into public.event_avisos (
    id, title, body, sort_order, is_published, audience,
    created_by_profile_id, updated_by_profile_id
  )
  values (
    v_id, v_title, v_body, coalesce(p_sort_order, 0), coalesce(p_is_published, true), v_audience,
    p_actor_profile_id, p_actor_profile_id
  )
  on conflict (id) do update
    set title = excluded.title,
        body = excluded.body,
        sort_order = excluded.sort_order,
        is_published = excluded.is_published,
        audience = excluded.audience,
        updated_at = now(),
        updated_by_profile_id = p_actor_profile_id
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Aviso salvo.',
    'id', v_row.id,
    'title', v_row.title,
    'body', v_row.body,
    'sort_order', v_row.sort_order,
    'is_published', v_row.is_published,
    'audience', v_row.audience,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.salvar_event_aviso(
  uuid, uuid, text, text, integer, boolean, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.small_group',
    'Card — Pequeno Grupo',
    'Card do membro com dados da célula, roteiro da semana e aviso de ausência.',
    true
  ),
  (
    'screen',
    'maintenance.card.small_groups_management',
    'Gestão de Pequenos Grupos',
    'Cadastro de células, chamada, visitantes e relatório espiritual.',
    true
  ),
  (
    'table',
    'small_groups',
    'Pequenos grupos',
    null,
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code = 'super_admin'
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'dashboard.card.small_group'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado', 'events_admin'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true,
       r.code in ('super_admin', 'pastoral', 'lider_geral', 'gestor_controle_acesso')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.small_groups_management'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'gestor_controle_acesso'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Se o mural já existir, restaura o filtro opportunity_match e remove overload antigo do salvar.
do $restore_opportunity_match$
begin
  if to_regclass('public.volunteer_opportunities') is null then
    return;
  end if;

  drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean);
  drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean, text);

  execute $fn$
create or replace function public.listar_event_avisos_publicados()
returns setof public.event_avisos
language plpgsql
stable
security definer
set search_path = public
as $listar$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_is_leader boolean := false;
  v_winner text;
begin
  if v_actor is not null then
    select exists (
      select 1
        from public.small_groups g
       where g.is_active
         and (v_tenant is null or g.tenant_id = v_tenant)
         and (g.leader_profile_id = v_actor or g.host_profile_id = v_actor)
    ) into v_is_leader;

    select r.perfil_vencedor into v_winner
      from public.ministerial_resultados r
     where r.profile_id = v_actor
       and (v_tenant is null or r.tenant_id = v_tenant)
     order by r.completed_at desc nulls last
     limit 1;
  end if;

  return query
  select ea.*
    from public.event_avisos ea
    left join public.volunteer_opportunities o on o.id = ea.opportunity_id
   where ea.is_published is true
     and (v_tenant is null or ea.tenant_id is null or ea.tenant_id = v_tenant)
     and (
       coalesce(ea.audience, 'all') = 'all'
       or (ea.audience = 'small_group_leaders' and v_is_leader)
       or (
         ea.audience = 'opportunity_match'
         and v_winner is not null
         and o.id is not null
         and o.status = 'aberta'
         and (v_tenant is null or o.tenant_id = v_tenant)
         and v_winner = any(public.volunteer_gifts_normalized(o.required_gifts))
       )
     )
   order by ea.sort_order asc, ea.updated_at desc;
end;
$listar$;
$fn$;
end
$restore_opportunity_match$;

notify pgrst, 'reload schema';
