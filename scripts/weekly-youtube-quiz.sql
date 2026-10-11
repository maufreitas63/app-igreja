-- Quiz semanal da pregação mais recente do YouTube, isolado por igreja.
-- O par (tenant_id, video_id) impede repetir uma pregação já transformada em quiz.
-- Aplica: npx supabase db query --linked -f scripts/weekly-youtube-quiz.sql

begin;

create table if not exists public.weekly_quizzes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete restrict,
  video_id text not null,
  title text not null,
  sermon_published_at timestamptz not null,
  transcript text not null,
  status text not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint weekly_quizzes_video_id_check check (video_id ~ '^[A-Za-z0-9_-]{6,20}$'),
  constraint weekly_quizzes_status_check check (status in ('draft', 'published')),
  constraint weekly_quizzes_tenant_video_unique unique (tenant_id, video_id)
);

create table if not exists public.weekly_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.weekly_quizzes (id) on delete cascade,
  tenant_id uuid not null references public.igrejas (id) on delete restrict,
  position smallint not null,
  prompt text not null,
  options jsonb not null,
  correct_index smallint not null,
  bible_book text not null,
  bible_chapter integer not null,
  bible_verse integer not null,
  bible_reference text not null,
  constraint weekly_quiz_questions_position_check check (position between 1 and 10),
  constraint weekly_quiz_questions_correct_check check (correct_index between 0 and 3),
  constraint weekly_quiz_questions_chapter_check check (bible_chapter > 0),
  constraint weekly_quiz_questions_verse_check check (bible_verse > 0),
  constraint weekly_quiz_questions_quiz_position_unique unique (quiz_id, position)
);

create table if not exists public.weekly_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete restrict,
  quiz_id uuid not null references public.weekly_quizzes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null default 0,
  answered_count integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint weekly_quiz_attempts_score_check check (score >= 0),
  constraint weekly_quiz_attempts_unique unique (quiz_id, profile_id)
);

create table if not exists public.weekly_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete restrict,
  attempt_id uuid not null references public.weekly_quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.weekly_quiz_questions (id) on delete cascade,
  selected_index smallint not null,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  constraint weekly_quiz_answers_selected_check check (selected_index between 0 and 3),
  constraint weekly_quiz_answers_unique unique (attempt_id, question_id)
);

create table if not exists public.weekly_quiz_scores (
  tenant_id uuid not null references public.igrejas (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  total_points integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, profile_id),
  constraint weekly_quiz_scores_points_check check (total_points >= 0)
);

create index if not exists weekly_quizzes_tenant_status_idx
  on public.weekly_quizzes (tenant_id, status, sermon_published_at desc);

alter table public.weekly_quizzes enable row level security;
alter table public.weekly_quiz_questions enable row level security;
alter table public.weekly_quiz_attempts enable row level security;
alter table public.weekly_quiz_answers enable row level security;
alter table public.weekly_quiz_scores enable row level security;

revoke all on table public.weekly_quizzes from public, anon, authenticated;
revoke all on table public.weekly_quiz_questions from public, anon, authenticated;
revoke all on table public.weekly_quiz_attempts from public, anon, authenticated;
revoke all on table public.weekly_quiz_answers from public, anon, authenticated;
revoke all on table public.weekly_quiz_scores from public, anon, authenticated;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'maintenance.card.weekly_quiz',
  'Quiz semanal',
  'A secretaria busca a pregação mais recente do YouTube e publica o quiz de 10 perguntas.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select g.role_id, dest.id, true, true
  from public.access_resources dest
  join public.access_resources src
    on src.resource_type = 'screen'
   and src.resource_key = 'maintenance.card.event_orchestration'
  join public.access_grants g
    on g.resource_id = src.id
 where dest.resource_type = 'screen'
   and dest.resource_key = 'maintenance.card.weekly_quiz'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

create or replace function public.weekly_quiz_assert_editor()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
begin
  if v_profile is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if not public.session_has_resource_access('screen', 'maintenance.card.weekly_quiz', 'update') then
    raise exception 'Sem permissão para lançar o quiz semanal.';
  end if;

  return v_tenant;
end;
$$;

create or replace function public.weekly_quiz_admin_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_profile uuid := public.current_session_profile_id();
  v_youtube text;
  v_draft jsonb;
  v_ranking jsonb;
begin
  select nullif(trim(i.youtube_url), '')
    into v_youtube
  from public.igrejas i
  where i.id = v_tenant;

  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'videoId', q.video_id,
    'sermonPublishedAt', q.sermon_published_at,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', qq.position,
          'prompt', qq.prompt,
          'options', qq.options,
          'correctIndex', qq.correct_index,
          'bibleReference', qq.bible_reference
        )
        order by qq.position
      )
      from public.weekly_quiz_questions qq
      where qq.quiz_id = q.id
        and qq.tenant_id = v_tenant
    ), '[]'::jsonb)
  )
    into v_draft
  from public.weekly_quizzes q
  where q.tenant_id = v_tenant
    and q.status = 'draft'
  order by q.created_at desc
  limit 1;

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.points desc, r.name), '[]'::jsonb)
    into v_ranking
  from (
    select coalesce(nullif(trim(p.full_name), ''), 'Sem nome') as name,
           s.total_points as points
      from public.weekly_quiz_scores s
      join public.profiles p
        on p.id = s.profile_id
     where s.tenant_id = v_tenant
       and public.profile_visible_to_access_actor(v_profile, s.profile_id)
     order by s.total_points desc, 1
     limit 30
  ) r;

  return jsonb_build_object(
    'youtubeUrl', v_youtube,
    'draft', v_draft,
    'ranking', v_ranking
  );
end;
$$;

create or replace function public.weekly_quiz_prepare_generation()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_youtube text;
  v_used jsonb;
begin
  if exists (
    select 1
      from public.weekly_quizzes q
     where q.tenant_id = v_tenant
       and q.status = 'draft'
  ) then
    raise exception 'Já existe um quiz em prévia. Publique ou descarte antes de buscar outra pregação.';
  end if;

  select nullif(trim(i.youtube_url), '')
    into v_youtube
  from public.igrejas i
  where i.id = v_tenant;

  if v_youtube is null then
    raise exception 'Cadastre a URL do canal do YouTube desta igreja em Instâncias.';
  end if;

  select coalesce(jsonb_agg(q.video_id), '[]'::jsonb)
    into v_used
  from public.weekly_quizzes q
  where q.tenant_id = v_tenant;

  return jsonb_build_object(
    'youtubeUrl', v_youtube,
    'usedVideoIds', v_used
  );
end;
$$;

create or replace function public.weekly_quiz_store_draft(
  p_video_id text,
  p_title text,
  p_sermon_published_at timestamptz,
  p_transcript text,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_profile uuid := public.current_session_profile_id();
  v_video text := trim(coalesce(p_video_id, ''));
  v_title text := trim(coalesce(p_title, ''));
  v_transcript text := trim(coalesce(p_transcript, ''));
  v_quiz_id uuid;
  v_count int;
begin
  if v_video !~ '^[A-Za-z0-9_-]{6,20}$' then
    raise exception 'Vídeo do YouTube inválido.';
  end if;

  if v_title = '' or p_sermon_published_at is null then
    raise exception 'A pregação precisa de título e data de publicação.';
  end if;

  if length(v_transcript) < 400 then
    raise exception 'A transcrição desta pregação está curta demais para gerar o quiz.';
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array'
     or jsonb_array_length(p_questions) <> 10 then
    raise exception 'O quiz precisa ter exatamente 10 perguntas.';
  end if;

  if exists (
    select 1
      from public.weekly_quizzes q
     where q.tenant_id = v_tenant
       and q.video_id = v_video
  ) then
    raise exception 'Esta pregação já foi transformada em quiz.';
  end if;

  if exists (
    select 1
      from public.weekly_quizzes q
     where q.tenant_id = v_tenant
       and q.status = 'draft'
  ) then
    raise exception 'Já existe um quiz em prévia. Publique ou descarte antes de buscar outra pregação.';
  end if;

  select count(*)
    into v_count
  from jsonb_array_elements(p_questions) item
  where jsonb_typeof(item -> 'options') = 'array'
    and jsonb_array_length(item -> 'options') = 4
    and coalesce((item ->> 'correctIndex')::int, -1) between 0 and 3
    and length(trim(coalesce(item ->> 'prompt', ''))) > 0
    and length(trim(coalesce(item ->> 'bibleBook', ''))) > 0
    and coalesce((item ->> 'bibleChapter')::int, 0) > 0
    and coalesce((item ->> 'bibleVerse')::int, 0) > 0
    and length(trim(coalesce(item ->> 'bibleReference', ''))) > 0;

  if v_count <> 10 then
    raise exception 'Cada pergunta precisa de 4 alternativas e uma referência bíblica da pregação.';
  end if;

  insert into public.weekly_quizzes (
    tenant_id, video_id, title, sermon_published_at, transcript, status, created_by
  ) values (
    v_tenant,
    v_video,
    left(v_title, 300),
    p_sermon_published_at,
    left(v_transcript, 150000),
    'draft',
    v_profile
  )
  returning id into v_quiz_id;

  insert into public.weekly_quiz_questions (
    quiz_id, tenant_id, position, prompt, options, correct_index,
    bible_book, bible_chapter, bible_verse, bible_reference
  )
  select
    v_quiz_id,
    v_tenant,
    q.ord::smallint,
    trim(q.item ->> 'prompt'),
    q.item -> 'options',
    (q.item ->> 'correctIndex')::smallint,
    trim(q.item ->> 'bibleBook'),
    (q.item ->> 'bibleChapter')::int,
    (q.item ->> 'bibleVerse')::int,
    trim(q.item ->> 'bibleReference')
  from jsonb_array_elements(p_questions) with ordinality as q(item, ord);

  return public.weekly_quiz_admin_snapshot();
end;
$$;

create or replace function public.weekly_quiz_publish(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_updated int;
begin
  update public.weekly_quizzes
     set status = 'published'
   where id = p_quiz_id
     and tenant_id = v_tenant
     and status = 'draft';

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'Quiz não encontrado nesta igreja.';
  end if;

  if (
    select count(*)
      from public.weekly_quiz_questions qq
     where qq.quiz_id = p_quiz_id
       and qq.tenant_id = v_tenant
  ) <> 10 then
    raise exception 'O quiz precisa ter exatamente 10 perguntas.';
  end if;

  return public.weekly_quiz_admin_snapshot();
end;
$$;

create or replace function public.weekly_quiz_discard_draft(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_deleted int;
begin
  delete from public.weekly_quizzes
   where id = p_quiz_id
     and tenant_id = v_tenant
     and status = 'draft';

  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'Rascunho não encontrado nesta igreja.';
  end if;

  return public.weekly_quiz_admin_snapshot();
end;
$$;

create or replace function public.weekly_quiz_for_member()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
  v_quiz public.weekly_quizzes%rowtype;
  v_attempt public.weekly_quiz_attempts%rowtype;
  v_total int := 0;
  v_questions jsonb;
begin
  if v_tenant is null or v_profile is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  select *
    into v_quiz
  from public.weekly_quizzes q
  where q.tenant_id = v_tenant
    and q.status = 'published'
  order by q.sermon_published_at desc, q.created_at desc
  limit 1;

  if v_quiz.id is null then
    return jsonb_build_object('quiz', null, 'totalScore', 0);
  end if;

  select *
    into v_attempt
  from public.weekly_quiz_attempts a
  where a.quiz_id = v_quiz.id
    and a.profile_id = v_profile
    and a.tenant_id = v_tenant;

  select coalesce(s.total_points, 0)
    into v_total
  from public.weekly_quiz_scores s
  where s.tenant_id = v_tenant
    and s.profile_id = v_profile;

  select coalesce(jsonb_agg(item order by (item ->> 'position')::int), '[]'::jsonb)
    into v_questions
  from (
    select jsonb_build_object(
      'id', qq.id,
      'position', qq.position,
      'prompt', qq.prompt,
      'options', qq.options,
      'answered', ans.id is not null,
      'selectedIndex', ans.selected_index,
      'isCorrect', ans.is_correct,
      'bibleReference', case when ans.id is not null then qq.bible_reference else null end,
      'correctOption', case
        when ans.id is not null then qq.options ->> qq.correct_index
        else null
      end
    ) as item
    from public.weekly_quiz_questions qq
    left join public.weekly_quiz_answers ans
      on ans.question_id = qq.id
     and ans.attempt_id = v_attempt.id
     and ans.tenant_id = v_tenant
    where qq.quiz_id = v_quiz.id
      and qq.tenant_id = v_tenant
  ) listed;

  return jsonb_build_object(
    'totalScore', coalesce(v_total, 0),
    'quiz', jsonb_build_object(
      'id', v_quiz.id,
      'title', v_quiz.title,
      'videoId', v_quiz.video_id,
      'sermonPublishedAt', v_quiz.sermon_published_at,
      'completed', v_attempt.completed_at is not null,
      'weekScore', coalesce(v_attempt.score, 0),
      'answeredCount', coalesce(v_attempt.answered_count, 0),
      'questions', v_questions
    )
  );
end;
$$;

create or replace function public.weekly_quiz_submit_answer(
  p_question_id uuid,
  p_selected_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
  v_question public.weekly_quiz_questions%rowtype;
  v_quiz public.weekly_quizzes%rowtype;
  v_attempt_id uuid;
  v_correct boolean;
  v_points int;
  v_week int;
  v_total int;
  v_count int;
  v_completed boolean;
begin
  if v_tenant is null or v_profile is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if p_selected_index is null or p_selected_index < 0 or p_selected_index > 3 then
    raise exception 'Escolha uma alternativa.';
  end if;

  select qq.*
    into v_question
  from public.weekly_quiz_questions qq
  where qq.id = p_question_id
    and qq.tenant_id = v_tenant;

  if v_question.id is null then
    raise exception 'Pergunta não encontrada nesta igreja.';
  end if;

  select q.*
    into v_quiz
  from public.weekly_quizzes q
  where q.id = v_question.quiz_id
    and q.tenant_id = v_tenant
    and q.status = 'published';

  if v_quiz.id is null then
    raise exception 'Este quiz ainda não foi publicado.';
  end if;

  if v_quiz.id is distinct from (
    select published.id
      from public.weekly_quizzes published
     where published.tenant_id = v_tenant
       and published.status = 'published'
     order by published.sermon_published_at desc, published.created_at desc
     limit 1
  ) then
    raise exception 'Este quiz não é o desafio atual desta igreja.';
  end if;

  insert into public.weekly_quiz_attempts (tenant_id, quiz_id, profile_id)
  values (v_tenant, v_quiz.id, v_profile)
  on conflict (quiz_id, profile_id) do update
    set tenant_id = excluded.tenant_id
  returning id into v_attempt_id;

  v_correct := p_selected_index = v_question.correct_index;
  v_points := case when v_correct then 10 else 0 end;

  insert into public.weekly_quiz_answers (
    tenant_id, attempt_id, question_id, selected_index, is_correct
  ) values (
    v_tenant, v_attempt_id, v_question.id, p_selected_index, v_correct
  );

  update public.weekly_quiz_attempts
     set score = score + v_points,
         answered_count = answered_count + 1,
         completed_at = case
           when answered_count + 1 >= 10 then now()
           else completed_at
         end
   where id = v_attempt_id
     and tenant_id = v_tenant
  returning score, answered_count, completed_at is not null
    into v_week, v_count, v_completed;

  insert into public.weekly_quiz_scores (tenant_id, profile_id, total_points)
  values (v_tenant, v_profile, v_points)
  on conflict (tenant_id, profile_id) do update
    set total_points = public.weekly_quiz_scores.total_points + excluded.total_points,
        updated_at = now()
  returning total_points into v_total;

  return jsonb_build_object(
    'isCorrect', v_correct,
    'bibleReference', v_question.bible_reference,
    'correctOption', v_question.options ->> v_question.correct_index,
    'weekScore', v_week,
    'totalScore', v_total,
    'completed', v_completed,
    'answeredCount', v_count
  );
exception
  when unique_violation then
    raise exception 'Esta pergunta já foi respondida.';
end;
$$;

revoke all on function public.weekly_quiz_assert_editor() from public;
revoke all on function public.weekly_quiz_admin_snapshot() from public;
revoke all on function public.weekly_quiz_prepare_generation() from public;
revoke all on function public.weekly_quiz_store_draft(text, text, timestamptz, text, jsonb) from public;
revoke all on function public.weekly_quiz_publish(uuid) from public;
revoke all on function public.weekly_quiz_discard_draft(uuid) from public;
revoke all on function public.weekly_quiz_for_member() from public;
revoke all on function public.weekly_quiz_submit_answer(uuid, integer) from public;

grant execute on function public.weekly_quiz_assert_editor() to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_admin_snapshot() to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_prepare_generation() to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_store_draft(text, text, timestamptz, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_publish(uuid) to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_discard_draft(uuid) to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_for_member() to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_submit_answer(uuid, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
