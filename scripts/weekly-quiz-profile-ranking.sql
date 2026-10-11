-- Ranking individual do quiz no Perfil.
-- Empate: quem respondeu primeiro.
-- Aplica: npx supabase db query --linked -f scripts/weekly-quiz-profile-ranking.sql

begin;

alter table public.weekly_quiz_scores
  add column if not exists score_reached_at timestamptz;

update public.weekly_quiz_scores
   set score_reached_at = updated_at
 where total_points > 0
   and score_reached_at is null;

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
  else
    new.score_reached_at := old.score_reached_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_weekly_quiz_scores_mark_reached on public.weekly_quiz_scores;

create trigger trg_weekly_quiz_scores_mark_reached
before insert or update on public.weekly_quiz_scores
for each row
execute function public.weekly_quiz_scores_mark_reached();

create or replace function public.weekly_quiz_profile_ranking()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
  v_top jsonb;
  v_me jsonb;
  v_position int;
  v_points int;
  v_in_top boolean;
begin
  if v_tenant is null or v_profile is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  with people as (
    select
      s.profile_id,
      coalesce(nullif(trim(p.full_name), ''), 'Sem nome') as name,
      s.total_points as points,
      s.score_reached_at,
      (
        select min(ans.created_at)
          from public.weekly_quiz_attempts att
          join public.weekly_quiz_answers ans
            on ans.attempt_id = att.id
           and ans.tenant_id = att.tenant_id
         where att.tenant_id = v_tenant
           and att.profile_id = s.profile_id
      ) as first_answer_at
    from public.weekly_quiz_scores s
    join public.profiles p
      on p.id = s.profile_id
    where s.tenant_id = v_tenant
      -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
      and public.profile_visible_to_access_actor(v_profile, s.profile_id)
    union all
    select
      p.id,
      coalesce(nullif(trim(p.full_name), ''), 'Sem nome'),
      0,
      null,
      null
    from public.profiles p
    where p.id = v_profile
      and not exists (
        select 1
          from public.weekly_quiz_scores s
         where s.tenant_id = v_tenant
           and s.profile_id = v_profile
      )
  ),
  ranked as (
    select
      people.*,
      row_number() over (
        order by
          people.points desc,
          people.first_answer_at asc nulls last,
          people.score_reached_at asc nulls last,
          people.name asc
      )::int as position
    from people
  )
  select
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', r.position,
          'name', r.name,
          'points', r.points,
          'isMe', r.profile_id = v_profile
        )
        order by r.position
      )
      from ranked r
      where r.position <= 5
    ), '[]'::jsonb),
    (
      select jsonb_build_object(
        'position', r.position,
        'name', r.name,
        'points', r.points
      )
      from ranked r
      where r.profile_id = v_profile
    )
  into v_top, v_me;

  v_position := coalesce((v_me ->> 'position')::int, 0);
  v_points := coalesce((v_me ->> 'points')::int, 0);
  v_in_top := v_position between 1 and 5;

  return jsonb_build_object(
    'totalPoints', v_points,
    'position', v_position,
    'inTopFive', v_in_top,
    'top', v_top,
    'me', v_me
  );
end;
$$;

revoke all on function public.weekly_quiz_profile_ranking() from public;
grant execute on function public.weekly_quiz_profile_ranking() to anon, authenticated, service_role;

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
    'ranking', v_ranking
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
