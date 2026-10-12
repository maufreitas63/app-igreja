-- A prévia guarda 15 perguntas. A publicação grava só as 10 escolhidas.
-- Refazer as perguntas troca o conjunto da prévia e mantém a transcrição arquivada.

alter table public.weekly_quiz_questions
  drop constraint if exists weekly_quiz_questions_position_check;

alter table public.weekly_quiz_questions
  add constraint weekly_quiz_questions_position_check
  check (position between 1 and 15);

create or replace function public.weekly_quiz_count_valid_questions(p_questions jsonb)
returns integer
language sql
immutable
as $$
  select count(*)::integer
    from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) item
   where jsonb_typeof(item -> 'options') = 'array'
     and jsonb_array_length(item -> 'options') = 4
     and coalesce((item ->> 'correctIndex')::int, -1) between 0 and 3
     and length(trim(coalesce(item ->> 'prompt', ''))) > 0
     and length(trim(coalesce(item ->> 'bibleBook', ''))) > 0
     and coalesce((item ->> 'bibleChapter')::int, 0) > 0
     and coalesce((item ->> 'bibleVerse')::int, 0) > 0
     and length(trim(coalesce(item ->> 'bibleReference', ''))) > 0;
$$;

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

  if public.weekly_quiz_count_valid_questions(p_questions) <> 15
     or jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) <> 15 then
    raise exception 'A prévia precisa ter exatamente 15 perguntas.';
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

create or replace function public.weekly_quiz_refresh_questions(
  p_video_id text,
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
  v_archive public.weekly_sermon_archives%rowtype;
  v_quiz_id uuid;
  v_status text;
  v_summary text;
begin
  if v_video !~ '^[A-Za-z0-9_-]{6,20}$' then
    raise exception 'Vídeo do YouTube inválido.';
  end if;

  if public.weekly_quiz_count_valid_questions(p_questions) <> 15
     or jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) <> 15 then
    raise exception 'A prévia precisa ter exatamente 15 perguntas.';
  end if;

  select *
    into v_archive
  from public.weekly_sermon_archives a
  where a.tenant_id = v_tenant
    and a.video_id = v_video;

  if v_archive.id is null or length(trim(coalesce(v_archive.transcript, ''))) < 400 then
    raise exception 'Não há transcrição gravada desta pregação para refazer as perguntas.';
  end if;

  select q.id, q.status
    into v_quiz_id, v_status
  from public.weekly_quizzes q
  where q.tenant_id = v_tenant
    and q.video_id = v_video
  limit 1;

  if v_status = 'published' then
    raise exception 'Exclua o quiz publicado desta data antes de refazer as perguntas. A transcrição permanece arquivada.';
  end if;

  if v_quiz_id is null and exists (
    select 1
      from public.weekly_quizzes q
     where q.tenant_id = v_tenant
       and q.status = 'draft'
  ) then
    raise exception 'Já existe um quiz em prévia. Publique ou descarte antes de gerar perguntas de outra pregação.';
  end if;

  v_summary := trim(coalesce(v_archive.context_summary, ''));

  if length(v_summary) < 80 then
    v_summary := 'Perguntas refeitas a partir da transcrição já gravada desta pregação, sem nova leitura do vídeo.';
  end if;

  if v_quiz_id is null then
    insert into public.weekly_quizzes (
      tenant_id, video_id, title, sermon_published_at, transcript, status, created_by
    ) values (
      v_tenant,
      v_video,
      left(v_archive.title, 300),
      v_archive.sermon_published_at,
      left(v_archive.transcript, 150000),
      'draft',
      v_profile
    )
    returning id into v_quiz_id;
  else
    delete from public.weekly_quiz_questions
     where quiz_id = v_quiz_id
       and tenant_id = v_tenant;
  end if;

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

drop function if exists public.weekly_quiz_publish(uuid);

create or replace function public.weekly_quiz_publish(
  p_quiz_id uuid,
  p_question_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.weekly_quiz_assert_editor();
  v_updated int;
begin
  if coalesce(cardinality(p_question_ids), 0) <> 10
     or (select count(distinct id) from unnest(p_question_ids) as picked(id)) <> 10 then
    raise exception 'Escolha exatamente 10 perguntas para publicar.';
  end if;

  if not exists (
    select 1
      from public.weekly_quizzes q
     where q.id = p_quiz_id
       and q.tenant_id = v_tenant
       and q.status = 'draft'
  ) then
    raise exception 'Quiz não encontrado nesta igreja.';
  end if;

  if (
    select count(*)
      from public.weekly_quiz_questions qq
     where qq.quiz_id = p_quiz_id
       and qq.tenant_id = v_tenant
       and qq.id = any (p_question_ids)
  ) <> 10 then
    raise exception 'A seleção não corresponde às perguntas desta prévia.';
  end if;

  update public.weekly_quiz_questions qq
     set position = (100 + picked.ord)::smallint
    from unnest(p_question_ids) with ordinality as picked(id, ord)
   where qq.id = picked.id
     and qq.quiz_id = p_quiz_id
     and qq.tenant_id = v_tenant;

  delete from public.weekly_quiz_questions
   where quiz_id = p_quiz_id
     and tenant_id = v_tenant
     and not (id = any (p_question_ids));

  update public.weekly_quiz_questions
     set position = (position - 100)::smallint
   where quiz_id = p_quiz_id
     and tenant_id = v_tenant
     and position > 100;

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
       and qq.position between 1 and 10
  ) <> 10 then
    raise exception 'O quiz precisa ter exatamente 10 perguntas publicadas.';
  end if;

  return public.weekly_quiz_admin_snapshot();
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
          'id', qq.id,
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

revoke all on function public.weekly_quiz_count_valid_questions(jsonb) from public, anon, authenticated;
grant execute on function public.weekly_quiz_store_draft(text, text, timestamptz, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_refresh_questions(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.weekly_quiz_publish(uuid, uuid[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
