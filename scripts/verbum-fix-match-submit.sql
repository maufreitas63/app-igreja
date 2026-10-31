create or replace function public.verbum_submit_exercise(p_exercise_id int, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.verbum_learners;
  v_exercise public.verbum_exercises;
  v_correct boolean := false;
  v_paused boolean := false;
  v_lemma text;
  v_interval int;
  v_stability double precision;
  v_success int;
  v_expected text;
  v_hours numeric;
  v_target text[];
  v_heard text[];
  v_hits int := 0;
  v_cursor int := 1;
  v_word text;
  v_at int;
begin
  v_row := public.verbum_touch_learner();
  select * into v_exercise from public.verbum_exercises where id = p_exercise_id;
  if v_exercise.id is null then
    raise exception 'Exercício do Verbum não encontrado.';
  end if;

  if not v_row.has_infinite_shields and v_row.shields_count <= 0 then
    return jsonb_build_object(
      'correct', false,
      'paused', true,
      'shields', 0,
      'infinite_shields', false,
      'talents', v_row.talents_balance,
      'streak', v_row.current_lamp_streak,
      'expected_label', '',
      'message', 'Os Escudos de Fé acabaram. Aguarde 30 minutos, pratique no Altar de Memoriais ou assine o Verbum Fidelis.'
    );
  end if;

  if v_exercise.exercise_type = 'FILL_BLANK' then
    v_correct := lower(trim(coalesce(p_answer->>'choice', ''))) = lower(trim(v_exercise.payload->>'answer'));
    v_expected := v_exercise.payload->>'answer';
  elsif v_exercise.exercise_type in ('ORDER_WORDS', 'LISTENING_DICTATION') then
    v_correct := coalesce(p_answer->'order', '[]'::jsonb) = coalesce(v_exercise.payload->'answer', '[]'::jsonb);
    select string_agg(value, ' ') into v_expected
    from jsonb_array_elements_text(v_exercise.payload->'answer');
  elsif v_exercise.exercise_type = 'MATCH_PAIRS' then
    v_correct := (
      select coalesce(jsonb_agg(jsonb_build_object('en', en, 'pt', pt) order by en, pt), '[]'::jsonb)
      from jsonb_to_recordset(coalesce(p_answer->'matches', '[]'::jsonb)) as x(en text, pt text)
    ) = (
      select coalesce(jsonb_agg(jsonb_build_object('en', en, 'pt', pt) order by en, pt), '[]'::jsonb)
      from jsonb_to_recordset(coalesce(v_exercise.payload->'pairs', '[]'::jsonb)) as pair(en text, pt text)
    );
    select string_agg(pair.en || ' = ' || pair.pt, ', ' order by pair.en)
      into v_expected
    from jsonb_to_recordset(coalesce(v_exercise.payload->'pairs', '[]'::jsonb)) as pair(en text, pt text);
  elsif v_exercise.exercise_type = 'SPEAKING_VERSE' then
    v_expected := coalesce(nullif(btrim(v_exercise.payload->>'target_phrase'), ''), v_exercise.verse_target_en);
    v_hits := 0;
    v_cursor := 1;
    v_target := coalesce(
      array_remove(regexp_split_to_array(lower(regexp_replace(coalesce(v_expected, ''), '[^[:alnum:]'']+', ' ', 'g')), '\s+'), ''),
      array[]::text[]
    );
    v_heard := coalesce(
      array_remove(regexp_split_to_array(lower(regexp_replace(coalesce(p_answer->>'transcript', ''), '[^[:alnum:]'']+', ' ', 'g')), '\s+'), ''),
      array[]::text[]
    );
    foreach v_word in array v_target loop
      v_at := v_cursor;
      while v_at <= coalesce(array_length(v_heard, 1), 0) loop
        if v_heard[v_at] = v_word then
          v_hits := v_hits + 1;
          v_cursor := v_at + 1;
          exit;
        end if;
        v_at := v_at + 1;
      end loop;
    end loop;
    v_correct := coalesce(array_length(v_target, 1), 0) > 0
      and (v_hits::numeric / array_length(v_target, 1)) >= 0.8;
  else
    raise exception 'Tipo de exercício ainda não disponível.';
  end if;

  if not v_correct and not v_row.has_infinite_shields then
    update public.verbum_learners
    set shields_count = greatest(0, shields_count - 1),
        last_shield_lost_at = coalesce(last_shield_lost_at, now())
    where profile_id = v_row.profile_id
    returning * into v_row;
    v_paused := v_row.shields_count = 0;
  end if;

  v_lemma := nullif(trim(v_exercise.payload->>'lemma'), '');
  if v_lemma is not null then
    select stability_factor, repetition_interval, consecutive_success
      into v_stability, v_interval, v_success
    from public.verbum_word_mastery
    where profile_id = v_row.profile_id and word_or_lemma = v_lemma;

    v_stability := coalesce(v_stability, 2.5);
    v_interval := coalesce(v_interval, 0);
    v_success := coalesce(v_success, 0);

    if v_correct then
      v_success := v_success + 1;
      v_interval := case when v_interval = 0 then 1 when v_interval = 1 then 6 else round(v_interval * v_stability)::int end;
      v_stability := greatest(1.3, v_stability + 0.1);
    else
      v_success := 0;
      v_interval := 1;
      v_stability := greatest(1.3, v_stability - 0.2);
    end if;

    insert into public.verbum_word_mastery (
      profile_id, word_or_lemma, stability_factor, repetition_interval, consecutive_success,
      next_review_due, state, updated_at
    ) values (
      v_row.profile_id, v_lemma, v_stability, v_interval, v_success,
      now() + make_interval(days => v_interval),
      case when v_success >= 4 then 'MASTERED' when v_success >= 1 then 'REVIEWING' else 'LEARNING' end,
      now()
    )
    on conflict (profile_id, word_or_lemma) do update
      set stability_factor = excluded.stability_factor,
          repetition_interval = excluded.repetition_interval,
          consecutive_success = excluded.consecutive_success,
          next_review_due = excluded.next_review_due,
          state = excluded.state,
          updated_at = now();
  end if;

  if v_correct then
    v_hours := extract(epoch from (now() - coalesce(v_row.last_activity_at, now()))) / 3600;
    update public.verbum_learners
    set total_xp = total_xp + 5,
        last_activity_at = now(),
        current_lamp_streak = case
          when last_activity_at is null then 1
          when v_hours <= 36 and last_activity_at::date < current_date then current_lamp_streak + 1
          when v_hours > 36 then 1
          else current_lamp_streak
        end
    where profile_id = v_row.profile_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'paused', v_paused,
    'shields', v_row.shields_count,
    'infinite_shields', v_row.has_infinite_shields,
    'talents', v_row.talents_balance,
    'streak', v_row.current_lamp_streak,
    'expected_label', coalesce(v_expected, ''),
    'message', case
      when v_paused then 'Os Escudos de Fé acabaram. Aguarde 30 minutos, pratique no Altar de Memoriais ou assine o Verbum Fidelis.'
      when v_correct then 'Certo. A palavra de Deus permanece.'
      else 'A resposta correta está em destaque.'
    end
  );
end;
$$;

grant execute on function public.verbum_submit_exercise(int, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

