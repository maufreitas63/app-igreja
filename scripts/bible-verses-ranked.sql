-- Versículos-chave do curso, em ordem canônica.
-- Textos: King James (domínio público) e Tradução Brasileira (domínio público).
-- NVI e NIV não são copiadas: são traduções protegidas.
-- Referências cruzadas: OpenBible.info, CC BY (https://www.openbible.info/labs/cross-references/).
-- Aplica: npx supabase db query --linked -f scripts/bible-verses-ranked.sql

begin;

create table if not exists public.bible_verses (
  id serial primary key,
  book_id int not null references public.verbum_bible_books (id) on delete cascade,
  book_order int not null check (book_order between 1 and 66),
  chapter int not null check (chapter > 0),
  verse int not null check (verse > 0),
  verse_reference text not null,
  text_pt text not null,
  text_en text not null,
  translation_pt text not null default 'TB1917',
  translation_en text not null default 'KJV',
  cross_references_count int not null default 0,
  is_key_verse boolean not null default true,
  created_at timestamptz not null default now(),
  unique (book_id, chapter, verse),
  unique (verse_reference)
);

create index if not exists idx_bible_verses_canonical_order
  on public.bible_verses (book_order asc, chapter asc, verse asc);

create index if not exists idx_bible_verses_lookup
  on public.bible_verses (book_id, chapter, verse);

create or replace view public.bible_books as
select id, order_index, name_pt, name_en, abbreviation_en, chapters_count
from public.verbum_bible_books;

alter table public.bible_verses enable row level security;

drop policy if exists "Leitura pública de versículos" on public.bible_verses;
create policy "Leitura pública de versículos"
  on public.bible_verses
  for select
  using (true);

grant select on public.bible_verses to anon, authenticated;
grant select on public.bible_books to anon, authenticated;

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

notify pgrst, 'reload schema';

commit;
