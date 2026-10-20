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
  v_completed boolean;
begin
  if v_tenant is null or v_profile is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  v_completed := exists (
    select 1
      from public.weekly_quiz_attempts att
     where att.tenant_id = v_tenant
       and att.profile_id = v_profile
       and att.completed_at is not null
  );

  if not v_completed then
    return jsonb_build_object(
      'hasCompleted', false,
      'totalPoints', 0,
      'position', 0,
      'inTopFive', false,
      'top', '[]'::jsonb,
      'me', null
    );
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
      and exists (
        select 1
          from public.weekly_quiz_attempts att
         where att.tenant_id = v_tenant
           and att.profile_id = s.profile_id
           and att.completed_at is not null
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
    'hasCompleted', true,
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

notify pgrst, 'reload schema';

commit;
