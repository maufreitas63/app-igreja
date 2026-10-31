-- Fala do versículo: a sessão passa a entregar SPEAKING_VERSE e a Unidade 1 ganha pronúncia nos nós 1, 2 e 4.

create or replace function public.verbum_lesson_session(p_lesson_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.verbum_learners;
begin
  v_row := public.verbum_touch_learner();
  return jsonb_build_object(
    'learner', jsonb_build_object(
      'talents', v_row.talents_balance,
      'shields', v_row.shields_count,
      'infinite_shields', v_row.has_infinite_shields,
      'streak', v_row.current_lamp_streak,
      'tier', v_row.tier
    ),
    'lesson', (
      select jsonb_build_object(
        'id', l.id,
        'title', l.title,
        'unit_title', u.title,
        'theological_summary', l.theological_summary
      )
      from public.verbum_lessons l
      join public.verbum_curriculum_units u on u.id = l.unit_id
      where l.id = p_lesson_id
    ),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'exercise_type', e.exercise_type,
        'prompt', e.prompt,
        'bible_passage_ref', e.bible_passage_ref,
        'verse_target_en', coalesce(v.text_en, e.verse_target_en),
        'verse_target_pt', coalesce(v.text_pt, e.verse_target_pt),
        'audio_url', e.audio_url,
        'payload', e.payload
      ) order by e.id)
      from public.verbum_exercises e
      left join public.bible_verses v on v.verse_reference = e.bible_passage_ref
      where e.lesson_id = p_lesson_id
        and e.exercise_type in ('FILL_BLANK', 'ORDER_WORDS', 'MATCH_PAIRS', 'LISTENING_DICTATION', 'SPEAKING_VERSE')
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.verbum_lesson_session(int) to anon, authenticated;

delete from public.verbum_exercises e
using public.verbum_lessons l,
  public.verbum_path_nodes n,
  public.verbum_curriculum_units u,
  public.verbum_bible_books b
where e.lesson_id = l.id
  and l.node_id = n.id
  and n.unit_id = u.id
  and u.bible_book_id = b.id
  and e.exercise_type = 'SPEAKING_VERSE'
  and b.order_index = 1
  and u.order_index = 1
  and n.order_index in (1, 2, 4)
  and e.payload->>'target_phrase' in (
    'And God said, Let there be light',
    'In the beginning God created the heavens and the earth',
    'And God called the light Day',
    'Let there be a firmament in the midst of the waters',
    'Let us make man in our image',
    'Be fruitful and multiply'
  );

insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id,
  'SPEAKING_VERSE',
  v.prompt,
  v.ref,
  v.en,
  v.pt,
  jsonb_build_object('target_phrase', v.en, 'lemma', v.lemma)
from (
  values
    (1, 1, 3, 'Fale este versículo em inglês no microfone:', 'Genesis 1:3', 'And God said, Let there be light', 'E disse Deus: Haja luz', 'light'),
    (2, 1, 3, 'Pronuncie a frase da criação:', 'Genesis 1:1', 'In the beginning God created the heavens and the earth', 'No princípio criou Deus os céus e a terra', 'created'),
    (3, 2, 3, 'Fale este versículo em inglês no microfone:', 'Genesis 1:5', 'And God called the light Day', 'E Deus chamou à luz Dia', 'day'),
    (4, 2, 3, 'Pronuncie a separação das águas:', 'Genesis 1:6', 'Let there be a firmament in the midst of the waters', 'Haja um firmamento no meio das águas', 'firmament'),
    (5, 4, 3, 'Fale este versículo em inglês no microfone:', 'Genesis 1:26', 'Let us make man in our image', 'Façamos o homem à nossa imagem', 'image'),
    (6, 4, 3, 'Pronuncie a bênção da criação:', 'Genesis 1:28', 'Be fruitful and multiply', 'Frutificai e multiplicai-vos', 'fruitful')
) as v(seq, node_index, level_index, prompt, ref, en, pt, lemma)
join public.verbum_lessons l on l.level_index = v.level_index
join public.verbum_path_nodes n on n.id = l.node_id and n.order_index = v.node_index
join public.verbum_curriculum_units u on u.id = n.unit_id and u.order_index = 1
join public.verbum_bible_books b on b.id = u.bible_book_id and b.order_index = 1
where not exists (
  select 1
  from public.verbum_exercises e
  where e.lesson_id = l.id
    and e.exercise_type = 'SPEAKING_VERSE'
    and e.payload->>'target_phrase' = v.en
)
order by v.seq;

notify pgrst, 'reload schema';

select coalesce(jsonb_agg(jsonb_build_object(
  'node', n.order_index,
  'lesson', l.title,
  'phrase', e.payload->>'target_phrase'
) order by n.order_index, e.id), '[]'::jsonb) as speaking
from public.verbum_exercises e
join public.verbum_lessons l on l.id = e.lesson_id
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where e.exercise_type = 'SPEAKING_VERSE'
  and b.order_index = 1
  and u.order_index = 1
  and n.order_index in (1, 2, 4);
