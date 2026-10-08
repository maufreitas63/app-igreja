-- Eixo temático da aula (identidade, caráter, histórias, próximo).
-- Aplica: npx supabase db query --linked -f scripts/class-lesson-categories.sql

alter table public.class_lessons
  add column if not exists category text;

alter table public.class_lessons
  drop constraint if exists class_lessons_category_chk;

alter table public.class_lessons
  add constraint class_lessons_category_chk
  check (
    category is null
    or category in ('identidade', 'carater', 'historias', 'proximo')
  );

comment on column public.class_lessons.category is
  'Eixo temático: identidade, carater, historias ou proximo.';

create or replace function public.class_lesson_json(p_row public.class_lessons)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'event_id', p_row.event_id,
    'room_key', p_row.room_key,
    'teacher_id', p_row.teacher_id,
    'class_date', p_row.class_date,
    'title', p_row.title,
    'bible_passage', p_row.bible_passage,
    'main_objective', p_row.main_objective,
    'resources_notes', p_row.resources_notes,
    'family_extension', p_row.family_extension,
    'category', p_row.category
  );
$$;

drop function if exists public.save_class_lesson(uuid, text, text, text, text, text, text);

create or replace function public.save_class_lesson(
  p_event_id uuid,
  p_room_key text,
  p_title text,
  p_bible_passage text,
  p_main_objective text,
  p_resources_notes text,
  p_family_extension text,
  p_category text
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
  v_category text := lower(trim(coalesce(p_category, '')));
  v_date date;
  v_row public.class_lessons%rowtype;
begin
  if v_me is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if v_room not in ('KIDS', 'TEENS') then
    return jsonb_build_object('success', false, 'message', 'Sala inválida.');
  end if;

  if v_category not in ('identidade', 'carater', 'historias', 'proximo') then
    return jsonb_build_object('success', false, 'message', 'Escolha o eixo temático da aula.');
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
    title, bible_passage, main_objective, resources_notes, family_extension, category
  ) values (
    v_tenant, p_event_id, v_room, v_me, v_date,
    v_title, v_passage, v_objective, v_resources, v_family, v_category
  )
  on conflict (tenant_id, event_id, room_key) do update
    set teacher_id = excluded.teacher_id,
        class_date = excluded.class_date,
        title = excluded.title,
        bible_passage = excluded.bible_passage,
        main_objective = excluded.main_objective,
        resources_notes = excluded.resources_notes,
        family_extension = excluded.family_extension,
        category = excluded.category,
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
            'category', cl.category,
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

revoke all on function public.save_class_lesson(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_class_lesson(uuid, text, text, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.list_class_lesson_trail(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
