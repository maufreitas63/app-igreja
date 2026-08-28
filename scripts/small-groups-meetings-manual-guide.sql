-- Pequenos grupos: várias datas com horário, busca por nome, roteiro manual.
-- Identidade efetiva (Ghost): current_session_profile_id().
-- Aplica: npx supabase db query --linked -f scripts/small-groups-meetings-manual-guide.sql

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.small_group_meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  small_group_id uuid not null references public.small_groups (id) on delete cascade,
  meeting_date date not null,
  meeting_time time not null default time '19:30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint small_group_meetings_unique unique (small_group_id, meeting_date)
);

create index if not exists small_group_meetings_group_date_idx
  on public.small_group_meetings (small_group_id, meeting_date);

create table if not exists public.small_group_weekly_guides (
  tenant_id uuid primary key references public.igrejas (id) on delete cascade,
  title text not null,
  content text null,
  video_url text null,
  updated_at timestamptz not null default now(),
  updated_by_profile_id uuid null references public.profiles (id) on delete set null
);

alter table public.small_group_meetings enable row level security;
alter table public.small_group_weekly_guides enable row level security;

drop policy if exists small_group_meetings_tenant_all on public.small_group_meetings;
create policy small_group_meetings_tenant_all
  on public.small_group_meetings
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists small_group_weekly_guides_tenant_all on public.small_group_weekly_guides;
create policy small_group_weekly_guides_tenant_all
  on public.small_group_weekly_guides
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

create or replace function public.small_group_meetings_json(p_group_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'meeting_date', to_char(m.meeting_date, 'YYYY-MM-DD'),
          'meeting_time', to_char(m.meeting_time, 'HH24:MI')
        )
        order by m.meeting_date, m.meeting_time
      )
      from public.small_group_meetings m
     where m.small_group_id = p_group_id
    ),
    '[]'::jsonb
  );
$$;

grant execute on function public.small_group_meetings_json(uuid) to anon, authenticated;

create or replace function public.replace_small_group_meetings(p_group_id uuid, p_meetings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_item jsonb;
  v_date date;
  v_time time;
  v_first_date date;
  v_first_time time;
begin
  if v_actor is null or not public.can_admin_small_groups(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  if p_group_id is null then
    return jsonb_build_object('success', false, 'message', 'Grupo inválido.');
  end if;

  if not exists (
    select 1 from public.small_groups g
     where g.id = p_group_id and g.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.');
  end if;

  delete from public.small_group_meetings m
   where m.small_group_id = p_group_id
     and m.tenant_id = v_tenant;

  if p_meetings is not null and jsonb_typeof(p_meetings) = 'array' then
    for v_item in select value from jsonb_array_elements(p_meetings)
    loop
      begin
        v_date := nullif(trim(coalesce(v_item ->> 'meeting_date', '')), '')::date;
        v_time := coalesce(
          nullif(trim(coalesce(v_item ->> 'meeting_time', '')), '')::time,
          time '19:30'
        );
      exception
        when others then
          continue;
      end;

      if v_date is null then
        continue;
      end if;

      insert into public.small_group_meetings (
        tenant_id, small_group_id, meeting_date, meeting_time
      ) values (
        v_tenant, p_group_id, v_date, v_time
      )
      on conflict (small_group_id, meeting_date)
      do update set meeting_time = excluded.meeting_time, updated_at = now();
    end loop;
  end if;

  select m.meeting_date, m.meeting_time
    into v_first_date, v_first_time
    from public.small_group_meetings m
   where m.small_group_id = p_group_id
   order by m.meeting_date, m.meeting_time
   limit 1;

  if v_first_date is not null then
    update public.small_groups g
       set meeting_weekday = extract(dow from v_first_date)::smallint,
           meeting_time = v_first_time,
           updated_at = now()
     where g.id = p_group_id
       and g.tenant_id = v_tenant;
  end if;

  return jsonb_build_object(
    'success', true,
    'meetings', public.small_group_meetings_json(p_group_id)
  );
end;
$$;

grant execute on function public.replace_small_group_meetings(uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cadastro admin: inclui reuniões
-- ---------------------------------------------------------------------------

drop function if exists public.upsert_small_group_admin(uuid, text, integer, text, uuid, uuid, text, boolean);

create or replace function public.upsert_small_group_admin(
  p_id uuid default null,
  p_name text default null,
  p_meeting_weekday integer default null,
  p_meeting_time text default null,
  p_host_profile_id uuid default null,
  p_leader_profile_id uuid default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_meetings jsonb default '[]'::jsonb
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
  perform public.replace_small_group_meetings(v_id, coalesce(p_meetings, '[]'::jsonb));

  return jsonb_build_object('success', true, 'id', v_id, 'message', 'Grupo salvo.');
end;
$$;

grant execute on function public.upsert_small_group_admin(
  uuid, text, integer, text, uuid, uuid, text, boolean, jsonb
) to anon, authenticated;

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
            ),
            'meetings', public.small_group_meetings_json(g.id)
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

-- ---------------------------------------------------------------------------
-- Membro: próximas reuniões
-- ---------------------------------------------------------------------------

create or replace function public.list_my_small_group()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
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
      'member_count', (
        select count(*)::int
          from public.small_group_members m
         where m.small_group_id = v_group.id
           and m.tenant_id = v_tenant
      ),
      'meetings', public.small_group_meetings_json(v_group.id),
      'host', public.small_group_profile_json(v_group.host_profile_id),
      'leader', public.small_group_profile_json(v_group.leader_profile_id)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Busca: nome realmente filtra (LIKE de telefone só com dígitos)
-- ---------------------------------------------------------------------------

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
  v_digits text := regexp_replace(v_q, '\D', '', 'g');
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
               or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
               or (
                 length(v_digits) >= 2
                 and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
               )
             )
           order by p.full_name
           limit 50
        ) p
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Roteiro manual (não depende da Trilha)
-- ---------------------------------------------------------------------------

create or replace function public.save_small_group_manual_guide(
  p_title text default null,
  p_content text default null,
  p_video_url text default null
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
  v_title text := nullif(trim(coalesce(p_title, '')), '');
begin
  if v_actor is null or not (
    public.can_admin_small_groups(v_actor)
    or public.can_manage_discipleship_trail(v_actor)
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gravar o roteiro.');
  end if;

  if v_title is null then
    delete from public.small_group_weekly_guides where tenant_id = v_tenant;
    return jsonb_build_object('success', true, 'message', 'Roteiro manual removido.');
  end if;

  insert into public.small_group_weekly_guides (
    tenant_id, title, content, video_url, updated_at, updated_by_profile_id
  ) values (
    v_tenant,
    v_title,
    nullif(trim(coalesce(p_content, '')), ''),
    nullif(trim(coalesce(p_video_url, '')), ''),
    now(),
    v_actor
  )
  on conflict (tenant_id)
  do update set
    title = excluded.title,
    content = excluded.content,
    video_url = excluded.video_url,
    updated_at = now(),
    updated_by_profile_id = excluded.updated_by_profile_id;

  update public.discipleship_lessons
     set is_cell_weekly_guide = false,
         updated_at = now()
   where tenant_id = v_tenant
     and is_cell_weekly_guide;

  return jsonb_build_object('success', true, 'message', 'Roteiro da semana publicado.');
end;
$$;

grant execute on function public.save_small_group_manual_guide(text, text, text) to anon, authenticated;

create or replace function public.get_current_small_group_guide()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_manual public.small_group_weekly_guides%rowtype;
  v_row record;
begin
  select *
    into v_manual
    from public.small_group_weekly_guides g
   where g.tenant_id = v_tenant;

  if v_manual.tenant_id is not null then
    return jsonb_build_object(
      'success', true,
      'guide', jsonb_build_object(
        'id', v_manual.tenant_id,
        'title', v_manual.title,
        'content', v_manual.content,
        'video_url', v_manual.video_url,
        'reflection_question', null,
        'module_title', 'Roteiro da semana'
      )
    );
  end if;

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

create or replace function public.get_small_group_manual_guide()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_row public.small_group_weekly_guides%rowtype;
begin
  if v_actor is null or not public.is_small_group_operator(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'guide', null);
  end if;

  select * into v_row
    from public.small_group_weekly_guides g
   where g.tenant_id = v_tenant;

  if v_row.tenant_id is null then
    return jsonb_build_object('success', true, 'guide', null);
  end if;

  return jsonb_build_object(
    'success', true,
    'guide', jsonb_build_object(
      'title', v_row.title,
      'content', v_row.content,
      'video_url', v_row.video_url
    )
  );
end;
$$;

grant execute on function public.get_small_group_manual_guide() to anon, authenticated;

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

    return jsonb_build_object('success', true, 'message', 'Roteiro da trilha despublicado.');
  end if;

  delete from public.small_group_weekly_guides where tenant_id = v_tenant;

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

  return jsonb_build_object('success', true, 'message', 'Roteiro da semana publicado a partir da Trilha.');
end;
$$;
