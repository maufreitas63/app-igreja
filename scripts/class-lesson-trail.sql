-- Trilha de ensino: servidores da aula e leitura para as famílias, isolada por instância.
-- Eixo temático (category): scripts/class-lesson-categories.sql
-- Aplica: npx supabase db query --linked -f scripts/class-lesson-trail.sql

create or replace function public.is_kids_room_servidor_scale(
  p_codigo text,
  p_nome text,
  p_configured_code text default null
)
returns boolean
language sql
immutable
as $$
  select
    (
      coalesce(public.normalize_scale_token(p_configured_code), '') <> ''
      and public.normalize_scale_token(p_codigo) = public.normalize_scale_token(p_configured_code)
    )
    or (
      (
        public.normalize_person_name(p_nome) like '%servidor%'
        or public.normalize_person_name(p_nome) like '%monitor%'
      )
      and public.normalize_person_name(p_nome) like '%kids%'
    )
    or (
      public.normalize_person_name(p_nome) like '%sala%'
      and public.normalize_person_name(p_nome) like '%kids%'
    )
    or public.normalize_person_name(p_nome) like '%ibn kids%'
    or public.normalize_person_name(p_nome) like '%ibnkids%'
    or public.normalize_person_name(p_codigo) like '%servidor_kids%'
    or public.normalize_person_name(p_codigo) like '%monitor_kids%'
    or public.normalize_person_name(p_codigo) like '%sala_kids%'
    or public.normalize_person_name(p_codigo) like '%ibn_kids%'
    or public.normalize_person_name(p_codigo) = 'servidor_ibn_kids'
    or public.normalize_person_name(p_codigo) = 'monitor_ibn_kids';
$$;

create or replace function public.is_teens_room_servidor_scale(
  p_codigo text,
  p_nome text,
  p_configured_code text default null
)
returns boolean
language sql
immutable
as $$
  select
    (
      coalesce(public.normalize_scale_token(p_configured_code), '') <> ''
      and public.normalize_scale_token(p_codigo) = public.normalize_scale_token(p_configured_code)
    )
    or (
      (
        public.normalize_person_name(p_nome) like '%servidor%'
        or public.normalize_person_name(p_nome) like '%monitor%'
      )
      and public.normalize_person_name(p_nome) like '%teens%'
    )
    or (
      public.normalize_person_name(p_nome) like '%sala%'
      and public.normalize_person_name(p_nome) like '%teens%'
    )
    or public.normalize_person_name(p_nome) like '%ibn teens%'
    or public.normalize_person_name(p_nome) like '%ibnteens%'
    or public.normalize_person_name(p_codigo) like '%servidor_teens%'
    or public.normalize_person_name(p_codigo) like '%monitor_teens%'
    or public.normalize_person_name(p_codigo) like '%sala_teens%'
    or public.normalize_person_name(p_codigo) like '%ibn_teens%'
    or public.normalize_person_name(p_codigo) = 'servidor_ibn_teens'
    or public.normalize_person_name(p_codigo) = 'monitor_ibn_teens';
$$;

create table if not exists public.class_lesson_servers (
  lesson_id uuid not null references public.class_lessons (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (lesson_id, profile_id)
);

create index if not exists class_lesson_servers_profile_idx
  on public.class_lesson_servers (profile_id);

comment on table public.class_lesson_servers is
  'Servidores escalados na sala na data da aula. Gravado junto com o planejamento.';

alter table public.class_lesson_servers enable row level security;

drop policy if exists class_lesson_servers_deny_direct on public.class_lesson_servers;
create policy class_lesson_servers_deny_direct
  on public.class_lesson_servers for all using (false) with check (false);

revoke all on public.class_lesson_servers from anon, authenticated, public;

create or replace function public.snapshot_class_lesson_servers(
  p_lesson_id uuid,
  p_tenant uuid,
  p_room text,
  p_date date
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_kids_code text;
  v_teens_code text;
begin
  if p_lesson_id is null or p_tenant is null or p_date is null then
    return;
  end if;

  v_kids_code := coalesce(
    nullif(trim(public.get_app_parameter_value('escala_codigo_servidor_kids')), ''),
    nullif(trim(public.get_app_parameter_value('escala_codigo_monitor_kids')), '')
  );
  v_teens_code := coalesce(
    nullif(trim(public.get_app_parameter_value('escala_codigo_servidor_teens')), ''),
    nullif(trim(public.get_app_parameter_value('escala_codigo_monitor_teens')), '')
  );

  delete from public.class_lesson_servers
   where lesson_id = p_lesson_id;

  insert into public.class_lesson_servers (lesson_id, profile_id)
  select distinct p_lesson_id, pr.id
    from public.escalas_log el
    join public.tipos_escala te
      on te.id = el.tipo_escala_id
     and te.tenant_id = p_tenant
    join public.voluntarios_escala ve
      on ve.id = el.voluntario_id
     and ve.tenant_id = p_tenant
    join public.profiles pr
      on pr.tenant_id = p_tenant
   where el.tenant_id = p_tenant
     and el.data_servico = p_date
     and te.is_ativa = true
     and (
       (
         p_room = 'KIDS'
         and (
           public.is_kids_room_servidor_scale(te.codigo, te.nome, v_kids_code)
           or public.normalize_person_name(te.nome) like '%infantil%'
           or public.normalize_person_name(te.codigo) like '%infantil%'
         )
       )
       or (
         p_room = 'TEENS'
         and (
           public.is_teens_room_servidor_scale(te.codigo, te.nome, v_teens_code)
           or public.normalize_person_name(te.nome) like '%jovem%'
           or public.normalize_person_name(te.codigo) like '%jovem%'
         )
       )
     )
     and (
       public.normalize_person_name(ve.nome) = public.normalize_person_name(pr.full_name)
       or public.normalize_person_name(ve.nome) = public.normalize_person_name(
         split_part(trim(pr.full_name), ' ', 1)
         || ' '
         || reverse(split_part(reverse(trim(pr.full_name)), ' ', 1))
       )
     );
end;
$$;

create or replace function public.class_lesson_servers_json(
  p_lesson_id uuid,
  p_tenant uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'full_name', coalesce(nullif(trim(pr.full_name), ''), 'Servidor'),
          'selfie_url', nullif(trim(pr.selfie_url), '')
        )
        order by pr.full_name
      )
      from public.class_lesson_servers ls
      join public.profiles pr
        on pr.id = ls.profile_id
       and pr.tenant_id = p_tenant
     where ls.lesson_id = p_lesson_id
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.save_class_lesson(
  p_event_id uuid,
  p_room_key text,
  p_title text,
  p_bible_passage text,
  p_main_objective text,
  p_resources_notes text,
  p_family_extension text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_room text := upper(trim(coalesce(p_room_key, '')));
  v_title text := trim(coalesce(p_title, ''));
  v_passage text := trim(coalesce(p_bible_passage, ''));
  v_objective text := trim(coalesce(p_main_objective, ''));
  v_resources text := nullif(trim(coalesce(p_resources_notes, '')), '');
  v_family text := nullif(trim(coalesce(p_family_extension, '')), '');
  v_date date;
  v_row public.class_lessons%rowtype;
begin
  if v_me is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if v_room not in ('KIDS', 'TEENS') then
    return jsonb_build_object('success', false, 'message', 'Sala inválida.');
  end if;

  if length(v_title) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o título ou tema da aula.');
  end if;

  if length(v_passage) < 1 then
    return jsonb_build_object('success', false, 'message', 'Informe a passagem bíblica.');
  end if;

  if length(v_objective) < 1 then
    return jsonb_build_object('success', false, 'message', 'Informe o que as crianças devem levar no coração.');
  end if;

  select public.event_local_date(e.event_date) into v_date
    from public.events e
   where e.id = p_event_id
     and e.tenant_id = v_tenant;

  if v_date is null then
    return jsonb_build_object('success', false, 'message', 'Evento não encontrado nesta instância.');
  end if;

  if not public.profile_can_record_room_attendance(v_me, v_room, v_date) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gravar o planejamento desta sala.');
  end if;

  insert into public.class_lessons (
    tenant_id, event_id, room_key, teacher_id, class_date,
    title, bible_passage, main_objective, resources_notes, family_extension
  ) values (
    v_tenant, p_event_id, v_room, v_me, v_date,
    v_title, v_passage, v_objective, v_resources, v_family
  )
  on conflict (tenant_id, event_id, room_key) do update
    set teacher_id = excluded.teacher_id,
        class_date = excluded.class_date,
        title = excluded.title,
        bible_passage = excluded.bible_passage,
        main_objective = excluded.main_objective,
        resources_notes = excluded.resources_notes,
        family_extension = excluded.family_extension,
        updated_at = now()
  returning * into v_row;

  perform public.snapshot_class_lesson_servers(v_row.id, v_tenant, v_room, v_date);

  return jsonb_build_object(
    'success', true,
    'message', 'Planejamento da aula gravado.',
    'lesson', public.class_lesson_json(v_row)
  );
end;
$$;

create or replace function public.list_class_lesson_trail(p_room_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_room text := upper(trim(coalesce(p_room_key, '')));
begin
  if v_me is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if v_room not in ('KIDS', 'TEENS') then
    return jsonb_build_object('success', false, 'message', 'Sala inválida.');
  end if;

  return jsonb_build_object(
    'success', true,
    'lessons',
    coalesce(
      (
        select jsonb_agg(item order by item->>'class_date' desc, item->>'title')
        from (
          select jsonb_build_object(
            'id', cl.id,
            'room_key', cl.room_key,
            'class_date', cl.class_date,
            'title', cl.title,
            'bible_passage', cl.bible_passage,
            'main_objective', cl.main_objective,
            'resources_notes', cl.resources_notes,
            'family_extension', cl.family_extension,
            'servers', public.class_lesson_servers_json(cl.id, v_tenant)
          ) as item
          from public.class_lessons cl
         where cl.tenant_id = v_tenant
           and cl.room_key = v_room
        ) listed
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_class_lesson_trail(text) to anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select id, tenant_id, room_key, class_date
      from public.class_lessons
  loop
    perform public.snapshot_class_lesson_servers(r.id, r.tenant_id, r.room_key, r.class_date);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
