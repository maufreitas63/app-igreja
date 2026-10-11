-- O membro vê o resumo contextual da pregação no quiz, sem a transcrição.
-- Aplica: npx supabase db query --linked -f scripts/weekly-quiz-member-context.sql

begin;

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
  v_summary text := '';
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

  select coalesce(arch.context_summary, '')
    into v_summary
  from public.weekly_sermon_archives arch
  where arch.tenant_id = v_tenant
    and arch.video_id = v_quiz.video_id;

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
      'contextSummary', coalesce(v_summary, ''),
      'completed', v_attempt.completed_at is not null,
      'weekScore', coalesce(v_attempt.score, 0),
      'answeredCount', coalesce(v_attempt.answered_count, 0),
      'questions', v_questions
    )
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
