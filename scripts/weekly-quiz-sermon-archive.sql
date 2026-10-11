-- Arquiva a transcrição e o resumo da pregação fora do quiz.
-- Excluir o quiz ou a pontuação de uma data não apaga esse arquivo.
-- Aplica: npx supabase db query --linked -f scripts/weekly-quiz-sermon-archive.sql

begin;

create table if not exists public.weekly_sermon_archives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete restrict,
  video_id text not null,
  title text not null,
  sermon_published_at timestamptz not null,
  transcript text not null,
  context_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_sermon_archives_video_id_check check (video_id ~ '^[A-Za-z0-9_-]{6,20}$'),
  constraint weekly_sermon_archives_tenant_video_unique unique (tenant_id, video_id)
);

create index if not exists weekly_sermon_archives_tenant_date_idx
  on public.weekly_sermon_archives (tenant_id, sermon_published_at desc);

alter table public.weekly_sermon_archives enable row level security;
revoke all on table public.weekly_sermon_archives from public, anon, authenticated;

insert into public.weekly_sermon_archives (
  tenant_id, video_id, title, sermon_published_at, transcript, context_summary
)
select
  q.tenant_id,
  q.video_id,
  q.title,
  q.sermon_published_at,
  q.transcript,
  ''
from public.weekly_quizzes q
on conflict (tenant_id, video_id) do update
  set transcript = excluded.transcript,
      title = excluded.title,
      sermon_published_at = excluded.sermon_published_at,
      updated_at = now()
where public.weekly_sermon_archives.transcript = '';

create or replace function public.weekly_quiz_scores_mark_reached()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.total_points > 0 then
      new.score_reached_at := coalesce(new.score_reached_at, now());
    end if;
    return new;
  end if;

  if new.total_points > old.total_points then
    new.score_reached_at := now();
  elsif new.total_points <= 0 then
    new.score_reached_at := null;
  else
    new.score_reached_at := coalesce(new.score_reached_at, old.score_reached_at);
  end if;

  return new;
end;
$$;

create or replace function public.weekly_quiz_reverse_attempt_scores(
  p_tenant uuid,
  p_quiz_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.weekly_quiz_scores s
     set total_points = greatest(0, s.total_points - a.score),
         updated_at = now()
    from public.weekly_quiz_attempts a
   where a.quiz_id = p_quiz_id
     and a.tenant_id = p_tenant
     and s.tenant_id = a.tenant_id
     and s.profile_id = a.profile_id
     and a.score > 0;
end;
$$;

revoke all on function public.weekly_quiz_reverse_attempt_scores(uuid, uuid) from public, anon, authenticated;

create or replace function public.weekly_quiz_sermon_archive(p_video_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_video text := trim(coalesce(p_video_id, ''));
  v_row public.weekly_sermon_archives%rowtype;
begin
  if v_video !~ '^[A-Za-z0-9_-]{6,20}$' then
    return null;
  end if;

  select *
    into v_row
  from public.weekly_sermon_archives a
  where a.tenant_id = v_tenant
    and a.video_id = v_video;

  if v_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'videoId', v_row.video_id,
    'title', v_row.title,
    'sermonPublishedAt', v_row.sermon_published_at,
    'transcript', v_row.transcript,
    'contextSummary', v_row.context_summary
  );
end;
$$;

revoke all on function public.weekly_quiz_sermon_archive(text) from public;
grant execute on function public.weekly_quiz_sermon_archive(text) to anon, authenticated, service_role;

drop function if exists public.weekly_quiz_store_draft(text, text, timestamptz, text, jsonb);

create or replace function public.weekly_quiz_store_draft(
  p_video_id text,
  p_title text,
  p_sermon_published_at timestamptz,
  p_transcript text,
  p_context_summary text,
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
  v_summary text := trim(coalesce(p_context_summary, ''));
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

  if length(v_summary) < 80 then
    raise exception 'O resumo contextual da pregação é obrigatório.';
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

  insert into public.weekly_sermon_archives (
    tenant_id, video_id, title, sermon_published_at, transcript, context_summary
  ) values (
    v_tenant,
    v_video,
    left(v_title, 300),
    p_sermon_published_at,
    left(v_transcript, 150000),
    left(v_summary, 12000)
  )
  on conflict (tenant_id, video_id) do update
    set title = excluded.title,
        sermon_published_at = excluded.sermon_published_at,
        transcript = excluded.transcript,
        context_summary = excluded.context_summary,
        updated_at = now();

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

revoke all on function public.weekly_quiz_store_draft(text, text, timestamptz, text, text, jsonb) from public;
grant execute on function public.weekly_quiz_store_draft(text, text, timestamptz, text, text, jsonb) to anon, authenticated, service_role;

create or replace function public.weekly_quiz_delete_published(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_deleted int;
begin
  if not exists (
    select 1
      from public.weekly_quizzes q
     where q.id = p_quiz_id
       and q.tenant_id = v_tenant
       and q.status = 'published'
  ) then
    raise exception 'Quiz publicado não encontrado nesta igreja.';
  end if;

  perform public.weekly_quiz_reverse_attempt_scores(v_tenant, p_quiz_id);

  delete from public.weekly_quizzes
   where id = p_quiz_id
     and tenant_id = v_tenant
     and status = 'published';

  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'Quiz publicado não encontrado nesta igreja.';
  end if;

  return public.weekly_quiz_admin_snapshot();
end;
$$;

revoke all on function public.weekly_quiz_delete_published(uuid) from public;
grant execute on function public.weekly_quiz_delete_published(uuid) to anon, authenticated, service_role;

create or replace function public.weekly_quiz_clear_scores(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
begin
  if not exists (
    select 1
      from public.weekly_quizzes q
     where q.id = p_quiz_id
       and q.tenant_id = v_tenant
       and q.status = 'published'
  ) then
    raise exception 'Quiz publicado não encontrado nesta igreja.';
  end if;

  perform public.weekly_quiz_reverse_attempt_scores(v_tenant, p_quiz_id);

  delete from public.weekly_quiz_attempts
   where quiz_id = p_quiz_id
     and tenant_id = v_tenant;

  return public.weekly_quiz_admin_snapshot();
end;
$$;

revoke all on function public.weekly_quiz_clear_scores(uuid) from public;
grant execute on function public.weekly_quiz_clear_scores(uuid) to anon, authenticated, service_role;

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
  v_published jsonb;
  v_archives jsonb;
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'title', q.title,
        'videoId', q.video_id,
        'sermonPublishedAt', q.sermon_published_at,
        'participantCount', (
          select count(*)
            from public.weekly_quiz_attempts a
           where a.quiz_id = q.id
             and a.tenant_id = v_tenant
        ),
        'contextSummary', coalesce(arch.context_summary, '')
      )
      order by q.sermon_published_at desc
    ),
    '[]'::jsonb
  )
    into v_published
  from public.weekly_quizzes q
  left join public.weekly_sermon_archives arch
    on arch.tenant_id = q.tenant_id
   and arch.video_id = q.video_id
  where q.tenant_id = v_tenant
    and q.status = 'published';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'videoId', arch.video_id,
        'title', arch.title,
        'sermonPublishedAt', arch.sermon_published_at,
        'contextSummary', arch.context_summary
      )
      order by arch.sermon_published_at desc
    ),
    '[]'::jsonb
  )
    into v_archives
  from public.weekly_sermon_archives arch
  where arch.tenant_id = v_tenant
    and not exists (
      select 1
        from public.weekly_quizzes q
       where q.tenant_id = arch.tenant_id
         and q.video_id = arch.video_id
    );

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  select coalesce(
    jsonb_agg(
      jsonb_build_object('name', r.name, 'points', r.points)
      order by r.position
    ),
    '[]'::jsonb
  )
    into v_ranking
  from (
    select
      coalesce(nullif(trim(p.full_name), ''), 'Sem nome') as name,
      s.total_points as points,
      row_number() over (
        order by
          s.total_points desc,
          (
            select min(ans.created_at)
              from public.weekly_quiz_attempts att
              join public.weekly_quiz_answers ans
                on ans.attempt_id = att.id
               and ans.tenant_id = att.tenant_id
             where att.tenant_id = v_tenant
               and att.profile_id = s.profile_id
          ) asc nulls last,
          s.score_reached_at asc nulls last,
          coalesce(nullif(trim(p.full_name), ''), 'Sem nome') asc
      )::int as position
    from public.weekly_quiz_scores s
    join public.profiles p
      on p.id = s.profile_id
    where s.tenant_id = v_tenant
      and public.profile_visible_to_access_actor(v_profile, s.profile_id)
  ) r
  where r.position <= 30;

  return jsonb_build_object(
    'youtubeUrl', v_youtube,
    'draft', v_draft,
    'published', v_published,
    'archives', v_archives,
    'ranking', v_ranking
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
