-- Planejamento de aula das salas Infantil e Jovens, isolado por instância.
-- Eixo temático (category): scripts/class-lesson-categories.sql
-- Aplica: npx supabase db query --linked -f scripts/class-lessons.sql

create table if not exists public.class_lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  room_key text not null check (room_key in ('KIDS', 'TEENS')),
  teacher_id uuid not null references public.profiles (id) on delete restrict,
  class_date date not null,
  title text not null,
  bible_passage text not null,
  main_objective text not null,
  resources_notes text null,
  family_extension text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_lessons_title_check check (length(trim(title)) >= 2),
  constraint class_lessons_passage_check check (length(trim(bible_passage)) >= 1),
  constraint class_lessons_objective_check check (length(trim(main_objective)) >= 1)
);

create unique index if not exists class_lessons_tenant_event_room_uq
  on public.class_lessons (tenant_id, event_id, room_key);

create index if not exists class_lessons_tenant_date_idx
  on public.class_lessons (tenant_id, class_date desc);

comment on table public.class_lessons is
  'Planejamento pedagógico da aula por sala (Infantil ou Jovens) e evento, isolado por tenant.';

alter table public.class_lessons enable row level security;

drop policy if exists class_lessons_deny_direct on public.class_lessons;
create policy class_lessons_deny_direct
  on public.class_lessons for all using (false) with check (false);

revoke all on public.class_lessons from anon, authenticated, public;

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
    'family_extension', p_row.family_extension
  );
$$;

create or replace function public.get_class_lesson(
  p_event_id uuid,
  p_room_key text
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
  v_row public.class_lessons%rowtype;
  v_date date;
begin
  if v_me is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if v_room not in ('KIDS', 'TEENS') then
    return jsonb_build_object('success', false, 'message', 'Sala inválida.');
  end if;

  select public.event_local_date(e.event_date) into v_date
    from public.events e
   where e.id = p_event_id
     and e.tenant_id = v_tenant;

  if v_date is null then
    return jsonb_build_object('success', false, 'message', 'Evento não encontrado nesta instância.');
  end if;

  if not public.profile_can_record_room_attendance(v_me, v_room, v_date) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para o planejamento desta sala.');
  end if;

  select * into v_row
    from public.class_lessons cl
   where cl.tenant_id = v_tenant
     and cl.event_id = p_event_id
     and cl.room_key = v_room;

  return jsonb_build_object(
    'success', true,
    'lesson', case when v_row.id is null then null else public.class_lesson_json(v_row) end
  );
end;
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

  return jsonb_build_object(
    'success', true,
    'message', 'Planejamento da aula gravado.',
    'lesson', public.class_lesson_json(v_row)
  );
end;
$$;

grant execute on function public.get_class_lesson(uuid, text) to anon, authenticated;
grant execute on function public.save_class_lesson(uuid, text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
