-- Verbum: inglês bíblico. Tabelas próprias.
-- Não altera profiles, subscriptions nem family da igreja.
-- Aplica: npx supabase db query --linked -f scripts/verbum-schema.sql

begin;

create table if not exists public.verbum_bible_books (
  id serial primary key,
  testament text not null check (testament in ('OLD_TESTAMENT', 'NEW_TESTAMENT')),
  division text not null check (division in (
    'LAW_PENTATEUCH', 'OT_HISTORY', 'POETRY_WISDOM', 'MAJOR_PROPHETS', 'MINOR_PROPHETS',
    'GOSPELS', 'NT_HISTORY', 'PAULINE_EPISTLES', 'GENERAL_EPISTLES', 'PROPHECY'
  )),
  order_index int not null unique,
  name_en text not null,
  name_pt text not null,
  abbreviation_en text not null,
  chapters_count int not null check (chapters_count > 0),
  cefr_recommended_level text not null check (cefr_recommended_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
);

create table if not exists public.verbum_curriculum_units (
  id serial primary key,
  bible_book_id int not null references public.verbum_bible_books (id) on delete cascade,
  division text not null,
  cefr_level text not null,
  order_index int not null,
  title text not null,
  theological_theme text not null,
  icon_name text not null default 'scroll',
  unique (bible_book_id, order_index)
);

create table if not exists public.verbum_lessons (
  id serial primary key,
  unit_id int not null references public.verbum_curriculum_units (id) on delete cascade,
  order_index int not null,
  title text not null,
  xp_reward int not null default 15,
  talents_reward int not null default 5,
  theological_summary text not null,
  unique (unit_id, order_index)
);

create table if not exists public.verbum_exercises (
  id serial primary key,
  lesson_id int not null references public.verbum_lessons (id) on delete cascade,
  exercise_type text not null check (exercise_type in (
    'MATCH_PAIRS', 'FILL_BLANK', 'ORDER_WORDS', 'LISTENING_DICTATION', 'SPEAKING_VERSE'
  )),
  prompt text not null,
  bible_passage_ref text,
  verse_target_en text not null,
  verse_target_pt text not null,
  audio_url text,
  payload jsonb not null
);

create table if not exists public.verbum_learners (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  tenant_id uuid references public.igrejas (id) on delete cascade,
  talents_balance int not null default 50,
  shields_count int not null default 5,
  has_infinite_shields boolean not null default false,
  last_shield_lost_at timestamptz,
  current_lamp_streak int not null default 0,
  last_activity_at timestamptz,
  total_xp int not null default 0,
  tier text not null default 'FREE',
  created_at timestamptz not null default now()
);

create table if not exists public.verbum_word_mastery (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  word_or_lemma text not null,
  theological_concept text,
  stability_factor double precision not null default 2.5,
  repetition_interval int not null default 0,
  consecutive_success int not null default 0,
  next_review_due timestamptz not null default now(),
  state text not null default 'LEARNING' check (state in ('LEARNING', 'REVIEWING', 'MASTERED')),
  updated_at timestamptz not null default now(),
  unique (profile_id, word_or_lemma)
);

create table if not exists public.verbum_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id int not null references public.verbum_lessons (id) on delete cascade,
  completed boolean not null default false,
  score_percentage int not null default 0,
  completed_at timestamptz,
  unique (profile_id, lesson_id)
);

create table if not exists public.verbum_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  tier text not null default 'FREE',
  status text not null default 'INACTIVE',
  cycle text,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.verbum_family_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.verbum_subscriptions (id) on delete cascade,
  name text not null default 'Família Verbum',
  max_members int not null default 6,
  created_at timestamptz not null default now()
);

create table if not exists public.verbum_family_members (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.verbum_family_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (family_group_id, profile_id)
);

insert into public.verbum_bible_books (
  testament, division, order_index, name_en, name_pt, abbreviation_en, chapters_count, cefr_recommended_level
) values
  ('OLD_TESTAMENT', 'LAW_PENTATEUCH', 1, 'Genesis', 'Gênesis', 'Gen', 50, 'A1'),
  ('OLD_TESTAMENT', 'LAW_PENTATEUCH', 2, 'Exodus', 'Êxodo', 'Exod', 40, 'A1'),
  ('OLD_TESTAMENT', 'LAW_PENTATEUCH', 3, 'Leviticus', 'Levítico', 'Lev', 27, 'A2'),
  ('OLD_TESTAMENT', 'LAW_PENTATEUCH', 4, 'Numbers', 'Números', 'Num', 36, 'A2'),
  ('OLD_TESTAMENT', 'LAW_PENTATEUCH', 5, 'Deuteronomy', 'Deuteronômio', 'Deut', 34, 'A2'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 6, 'Joshua', 'Josué', 'Josh', 24, 'A2'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 7, 'Judges', 'Juízes', 'Judg', 21, 'A2'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 8, 'Ruth', 'Rute', 'Ruth', 4, 'A2'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 9, '1 Samuel', '1 Samuel', '1Sam', 31, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 10, '2 Samuel', '2 Samuel', '2Sam', 24, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 11, '1 Kings', '1 Reis', '1Kgs', 22, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 12, '2 Kings', '2 Reis', '2Kgs', 25, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 13, '1 Chronicles', '1 Crônicas', '1Chr', 29, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 14, '2 Chronicles', '2 Crônicas', '2Chr', 36, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 15, 'Ezra', 'Esdras', 'Ezra', 10, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 16, 'Nehemiah', 'Neemias', 'Neh', 13, 'B1'),
  ('OLD_TESTAMENT', 'OT_HISTORY', 17, 'Esther', 'Ester', 'Esth', 10, 'A2'),
  ('OLD_TESTAMENT', 'POETRY_WISDOM', 18, 'Job', 'Jó', 'Job', 42, 'B1'),
  ('OLD_TESTAMENT', 'POETRY_WISDOM', 19, 'Psalms', 'Salmos', 'Ps', 150, 'B1'),
  ('OLD_TESTAMENT', 'POETRY_WISDOM', 20, 'Proverbs', 'Provérbios', 'Prov', 31, 'B2'),
  ('OLD_TESTAMENT', 'POETRY_WISDOM', 21, 'Ecclesiastes', 'Eclesiastes', 'Eccl', 12, 'B2'),
  ('OLD_TESTAMENT', 'POETRY_WISDOM', 22, 'Song of Solomon', 'Cânticos', 'Song', 8, 'B2'),
  ('OLD_TESTAMENT', 'MAJOR_PROPHETS', 23, 'Isaiah', 'Isaías', 'Isa', 66, 'B2'),
  ('OLD_TESTAMENT', 'MAJOR_PROPHETS', 24, 'Jeremiah', 'Jeremias', 'Jer', 52, 'B2'),
  ('OLD_TESTAMENT', 'MAJOR_PROPHETS', 25, 'Lamentations', 'Lamentações', 'Lam', 5, 'C1'),
  ('OLD_TESTAMENT', 'MAJOR_PROPHETS', 26, 'Ezekiel', 'Ezequiel', 'Ezek', 48, 'C1'),
  ('OLD_TESTAMENT', 'MAJOR_PROPHETS', 27, 'Daniel', 'Daniel', 'Dan', 12, 'B2'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 28, 'Hosea', 'Oseias', 'Hos', 14, 'B1'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 29, 'Joel', 'Joel', 'Joel', 3, 'B1'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 30, 'Amos', 'Amós', 'Amos', 9, 'B1'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 31, 'Obadiah', 'Obadias', 'Obad', 1, 'B2'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 32, 'Jonah', 'Jonas', 'Jonah', 4, 'A2'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 33, 'Micah', 'Miqueias', 'Mic', 7, 'B1'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 34, 'Nahum', 'Naum', 'Nah', 3, 'B2'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 35, 'Habakkuk', 'Habacuque', 'Hab', 3, 'B2'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 36, 'Zephaniah', 'Sofonias', 'Zeph', 3, 'B2'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 37, 'Haggai', 'Ageu', 'Hag', 2, 'B1'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 38, 'Zechariah', 'Zacarias', 'Zech', 14, 'B2'),
  ('OLD_TESTAMENT', 'MINOR_PROPHETS', 39, 'Malachi', 'Malaquias', 'Mal', 4, 'B2'),
  ('NEW_TESTAMENT', 'GOSPELS', 40, 'Matthew', 'Mateus', 'Matt', 28, 'A1'),
  ('NEW_TESTAMENT', 'GOSPELS', 41, 'Mark', 'Marcos', 'Mark', 16, 'A1'),
  ('NEW_TESTAMENT', 'GOSPELS', 42, 'Luke', 'Lucas', 'Luke', 24, 'A2'),
  ('NEW_TESTAMENT', 'GOSPELS', 43, 'John', 'João', 'John', 21, 'B1'),
  ('NEW_TESTAMENT', 'NT_HISTORY', 44, 'Acts', 'Atos', 'Acts', 28, 'B1'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 45, 'Romans', 'Romanos', 'Rom', 16, 'B2'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 46, '1 Corinthians', '1 Coríntios', '1Cor', 16, 'B2'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 47, '2 Corinthians', '2 Coríntios', '2Cor', 13, 'B2'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 48, 'Galatians', 'Gálatas', 'Gal', 6, 'C1'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 49, 'Ephesians', 'Efésios', 'Eph', 6, 'B2'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 50, 'Philippians', 'Filipenses', 'Phil', 4, 'B2'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 51, 'Colossians', 'Colossenses', 'Col', 4, 'B2'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 52, '1 Thessalonians', '1 Tessalonicenses', '1Thess', 5, 'B2'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 53, '2 Thessalonians', '2 Tessalonicenses', '2Thess', 3, 'C1'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 54, '1 Timothy', '1 Timóteo', '1Tim', 6, 'C1'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 55, '2 Timothy', '2 Timóteo', '2Tim', 4, 'C1'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 56, 'Titus', 'Tito', 'Titus', 3, 'C1'),
  ('NEW_TESTAMENT', 'PAULINE_EPISTLES', 57, 'Philemon', 'Filemom', 'Phlm', 1, 'C2'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 58, 'Hebrews', 'Hebreus', 'Heb', 13, 'B2'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 59, 'James', 'Tiago', 'Jas', 5, 'B2'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 60, '1 Peter', '1 Pedro', '1Pet', 5, 'B2'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 61, '2 Peter', '2 Pedro', '2Pet', 3, 'C1'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 62, '1 John', '1 João', '1John', 5, 'B2'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 63, '2 John', '2 João', '2John', 1, 'C1'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 64, '3 John', '3 João', '3John', 1, 'C1'),
  ('NEW_TESTAMENT', 'GENERAL_EPISTLES', 65, 'Jude', 'Judas', 'Jude', 1, 'C1'),
  ('NEW_TESTAMENT', 'PROPHECY', 66, 'Revelation', 'Apocalipse', 'Rev', 22, 'C1')
on conflict (order_index) do nothing;

insert into public.verbum_curriculum_units (
  bible_book_id, division, cefr_level, order_index, title, theological_theme, icon_name
)
select b.id, b.division, 'A1', 1,
  'The Foundations: Creation and Sovereign Power',
  'Atributos de Deus e verbos de criação',
  'scroll'
from public.verbum_bible_books b
where b.order_index = 1
  and not exists (
    select 1 from public.verbum_curriculum_units u where u.bible_book_id = b.id and u.order_index = 1
  );

insert into public.verbum_lessons (unit_id, order_index, title, xp_reward, talents_reward, theological_summary)
select u.id, 1,
  'Let There Be Light: Verbos Imperativos e Luz',
  15,
  5,
  'Deus fala e a criação acontece. O imperativo "let there be" mostra a palavra que traz luz.'
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1
  and u.order_index = 1
  and not exists (
    select 1 from public.verbum_lessons l where l.unit_id = u.id and l.order_index = 1
  );

insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK',
  'Complete o versículo.',
  'Genesis 1:3',
  'And God said, Let there be light: and there was light.',
  'E disse Deus: Haja luz; e houve luz.',
  jsonb_build_object(
    'sentence', 'And God said, Let there be _____.',
    'options', jsonb_build_array('light', 'night', 'sea'),
    'answer', 'light',
    'lemma', 'light'
  )
from public.verbum_lessons l
where l.title = 'Let There Be Light: Verbos Imperativos e Luz'
  and not exists (
    select 1 from public.verbum_exercises e
    where e.lesson_id = l.id and e.exercise_type = 'FILL_BLANK'
  );

insert into public.verbum_lessons (unit_id, order_index, title, xp_reward, talents_reward, theological_summary)
select u.id, 2,
  'God saw the light: o que é bom',
  15,
  5,
  'Deus olha para a luz e a declara boa. O verbo saw mostra o olhar de Deus sobre o que ele fez.'
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1
  and u.order_index = 1
  and not exists (
    select 1 from public.verbum_lessons l where l.unit_id = u.id and l.order_index = 2
  );

insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK',
  'Complete o versículo.',
  'Genesis 1:4',
  'And God saw the light, that it was good.',
  'E viu Deus que a luz era boa.',
  jsonb_build_object(
    'sentence', 'And God saw the light, that it was _____.',
    'options', jsonb_build_array('good', 'dark', 'void'),
    'answer', 'good',
    'lemma', 'good'
  )
from public.verbum_lessons l
where l.order_index = 2
  and not exists (
    select 1 from public.verbum_exercises e
    where e.lesson_id = l.id and e.exercise_type = 'FILL_BLANK'
  );

insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS',
  'Monte a frase na ordem do versículo.',
  'Genesis 1:4',
  'And God saw the light, that it was good.',
  'E viu Deus que a luz era boa.',
  jsonb_build_object(
    'shuffled', jsonb_build_array('the', 'saw', 'light', 'God'),
    'answer', jsonb_build_array('God', 'saw', 'the', 'light'),
    'lemma', 'saw'
  )
from public.verbum_lessons l
where l.order_index = 2
  and not exists (
    select 1 from public.verbum_exercises e
    where e.lesson_id = l.id and e.exercise_type = 'ORDER_WORDS'
  );

insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS',
  'Monte a frase na ordem do versículo.',
  'Genesis 1:1',
  'In the beginning God created the heaven and the earth.',
  'No princípio criou Deus os céus e a terra.',
  jsonb_build_object(
    'shuffled', jsonb_build_array('created', 'God', 'the', 'heaven'),
    'answer', jsonb_build_array('God', 'created', 'the', 'heaven'),
    'lemma', 'created'
  )
from public.verbum_lessons l
where l.title = 'Let There Be Light: Verbos Imperativos e Luz'
  and not exists (
    select 1 from public.verbum_exercises e
    where e.lesson_id = l.id and e.exercise_type = 'ORDER_WORDS'
  );

alter table public.verbum_bible_books enable row level security;
alter table public.verbum_curriculum_units enable row level security;
alter table public.verbum_lessons enable row level security;
alter table public.verbum_exercises enable row level security;
alter table public.verbum_learners enable row level security;
alter table public.verbum_word_mastery enable row level security;
alter table public.verbum_lesson_progress enable row level security;
alter table public.verbum_subscriptions enable row level security;
alter table public.verbum_family_groups enable row level security;
alter table public.verbum_family_members enable row level security;

drop policy if exists verbum_books_read on public.verbum_bible_books;
create policy verbum_books_read on public.verbum_bible_books for select using (true);
drop policy if exists verbum_units_read on public.verbum_curriculum_units;
create policy verbum_units_read on public.verbum_curriculum_units for select using (true);
drop policy if exists verbum_lessons_read on public.verbum_lessons;
create policy verbum_lessons_read on public.verbum_lessons for select using (true);
drop policy if exists verbum_exercises_read on public.verbum_exercises;
create policy verbum_exercises_read on public.verbum_exercises for select using (true);

drop policy if exists verbum_learners_own on public.verbum_learners;
create policy verbum_learners_own on public.verbum_learners
  for all using (profile_id = public.current_session_profile_id())
  with check (profile_id = public.current_session_profile_id());

drop policy if exists verbum_mastery_own on public.verbum_word_mastery;
create policy verbum_mastery_own on public.verbum_word_mastery
  for all using (profile_id = public.current_session_profile_id())
  with check (profile_id = public.current_session_profile_id());

drop policy if exists verbum_progress_own on public.verbum_lesson_progress;
create policy verbum_progress_own on public.verbum_lesson_progress
  for all using (profile_id = public.current_session_profile_id())
  with check (profile_id = public.current_session_profile_id());

grant select on public.verbum_bible_books, public.verbum_curriculum_units, public.verbum_lessons, public.verbum_exercises
  to anon, authenticated;

create or replace function public.verbum_touch_learner()
returns public.verbum_learners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_row public.verbum_learners;
  v_gain int;
begin
  if v_profile is null then
    raise exception 'Sessão do Verbum ausente.';
  end if;

  insert into public.verbum_learners (profile_id, tenant_id)
  values (v_profile, v_tenant)
  on conflict (profile_id) do update
    set tenant_id = coalesce(public.verbum_learners.tenant_id, excluded.tenant_id)
  returning * into v_row;

  if not v_row.has_infinite_shields
     and v_row.shields_count < 5
     and v_row.last_shield_lost_at is not null then
    v_gain := floor(extract(epoch from (now() - v_row.last_shield_lost_at)) / 1800)::int;
    if v_gain > 0 then
      update public.verbum_learners
      set shields_count = least(5, shields_count + v_gain),
          last_shield_lost_at = case
            when least(5, shields_count + v_gain) >= 5 then null
            else last_shield_lost_at + make_interval(mins => v_gain * 30)
          end
      where profile_id = v_profile
      returning * into v_row;
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.verbum_next_open_lesson(p_profile uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', l.id,
    'title', l.title,
    'unit_title', u.title,
    'theological_summary', l.theological_summary
  )
  from public.verbum_lessons l
  join public.verbum_curriculum_units u on u.id = l.unit_id
  join public.verbum_bible_books b on b.id = u.bible_book_id
  where not exists (
    select 1
    from public.verbum_lesson_progress p
    where p.profile_id = p_profile
      and p.lesson_id = l.id
      and p.completed
  )
  order by b.order_index, u.order_index, l.order_index
  limit 1;
$$;

create or replace function public.verbum_finish_lesson(p_lesson_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.verbum_learners;
  v_lesson public.verbum_lessons;
  v_already boolean;
begin
  v_row := public.verbum_touch_learner();
  select * into v_lesson from public.verbum_lessons where id = p_lesson_id;
  if v_lesson.id is null then
    raise exception 'Lição do Verbum não encontrada.';
  end if;

  select completed into v_already
  from public.verbum_lesson_progress
  where profile_id = v_row.profile_id and lesson_id = p_lesson_id;

  if coalesce(v_already, false) = false then
    insert into public.verbum_lesson_progress (profile_id, lesson_id, completed, score_percentage, completed_at)
    values (v_row.profile_id, p_lesson_id, true, 100, now())
    on conflict (profile_id, lesson_id) do update
      set completed = true,
          score_percentage = 100,
          completed_at = now();

    update public.verbum_learners
    set talents_balance = talents_balance + v_lesson.talents_reward,
        total_xp = total_xp + v_lesson.xp_reward
    where profile_id = v_row.profile_id;
  end if;

  return jsonb_build_object(
    'lesson', public.verbum_next_open_lesson(v_row.profile_id)
  );
end;
$$;

create or replace function public.verbum_course_home()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.verbum_learners;
  v_due int;
begin
  v_row := public.verbum_touch_learner();
  select count(*) into v_due
  from public.verbum_word_mastery m
  where m.profile_id = v_row.profile_id
    and m.next_review_due <= now();

  return jsonb_build_object(
    'learner', jsonb_build_object(
      'talents', v_row.talents_balance,
      'shields', v_row.shields_count,
      'infinite_shields', v_row.has_infinite_shields,
      'streak', v_row.current_lamp_streak,
      'tier', v_row.tier
    ),
    'memorials_due', v_due,
    'lesson', public.verbum_next_open_lesson(v_row.profile_id),
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_index', b.order_index,
        'name_en', b.name_en,
        'name_pt', b.name_pt,
        'abbreviation_en', b.abbreviation_en,
        'cefr', b.cefr_recommended_level,
        'division', b.division
      ) order by b.order_index)
      from public.verbum_bible_books b
    ), '[]'::jsonb)
  );
end;
$$;

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
        'verse_target_en', e.verse_target_en,
        'verse_target_pt', e.verse_target_pt,
        'audio_url', e.audio_url,
        'payload', e.payload
      ) order by e.id)
      from public.verbum_exercises e
      where e.lesson_id = p_lesson_id
        and e.exercise_type in ('FILL_BLANK', 'ORDER_WORDS')
    ), '[]'::jsonb)
  );
end;
$$;

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
  elsif v_exercise.exercise_type = 'ORDER_WORDS' then
    v_correct := coalesce(p_answer->'order', '[]'::jsonb) = coalesce(v_exercise.payload->'answer', '[]'::jsonb);
    select string_agg(value, ' ') into v_expected
    from jsonb_array_elements_text(v_exercise.payload->'answer');
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

create or replace function public.verbum_restore_shield()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.verbum_learners;
begin
  v_row := public.verbum_touch_learner();
  update public.verbum_learners
  set shields_count = least(5, shields_count + 1),
      last_shield_lost_at = case when least(5, shields_count + 1) >= 5 then null else last_shield_lost_at end
  where profile_id = v_row.profile_id
  returning * into v_row;

  return jsonb_build_object(
    'talents', v_row.talents_balance,
    'shields', v_row.shields_count,
    'infinite_shields', v_row.has_infinite_shields,
    'streak', v_row.current_lamp_streak,
    'tier', v_row.tier
  );
end;
$$;

create or replace function public.verbum_apply_stripe_event(
  p_profile_id uuid,
  p_tier text,
  p_status text,
  p_cycle text,
  p_customer text,
  p_subscription text,
  p_period_end timestamptz,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub uuid;
  v_family boolean := p_tier in ('FIDELIS_FAMILY', 'ALIANCA_FAMILY');
begin
  if p_profile_id is null then
    return;
  end if;

  insert into public.verbum_subscriptions (
    profile_id, tier, status, cycle, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at
  ) values (
    p_profile_id, coalesce(p_tier, 'FREE'), coalesce(p_status, 'INACTIVE'), p_cycle,
    p_customer, p_subscription, p_period_end, now()
  )
  on conflict (profile_id) do update
    set tier = excluded.tier,
        status = excluded.status,
        cycle = excluded.cycle,
        stripe_customer_id = coalesce(excluded.stripe_customer_id, public.verbum_subscriptions.stripe_customer_id),
        stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.verbum_subscriptions.stripe_subscription_id),
        current_period_end = excluded.current_period_end,
        updated_at = now()
  returning id into v_sub;

  update public.verbum_learners
  set has_infinite_shields = p_active,
      tier = case when p_active then coalesce(p_tier, tier) else 'FREE' end
  where profile_id = p_profile_id;

  if v_family and p_active then
    insert into public.verbum_family_groups (owner_id, subscription_id)
    select p_profile_id, v_sub
    where not exists (
      select 1 from public.verbum_family_groups g where g.owner_id = p_profile_id
    );
  end if;

  if not p_active then
    update public.verbum_learners learner
    set has_infinite_shields = false, tier = 'FREE'
    where learner.profile_id in (
      select m.profile_id
      from public.verbum_family_members m
      join public.verbum_family_groups g on g.id = m.family_group_id
      where g.owner_id = p_profile_id
    );
  end if;
end;
$$;

revoke all on function public.verbum_apply_stripe_event(uuid, text, text, text, text, text, timestamptz, boolean) from public;
grant execute on function public.verbum_touch_learner() to anon, authenticated;
grant execute on function public.verbum_course_home() to anon, authenticated;
grant execute on function public.verbum_lesson_session(int) to anon, authenticated;
grant execute on function public.verbum_submit_exercise(int, jsonb) to anon, authenticated;
grant execute on function public.verbum_restore_shield() to anon, authenticated;
grant execute on function public.verbum_next_open_lesson(uuid) to anon, authenticated;
grant execute on function public.verbum_finish_lesson(int) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.verbum_apply_stripe_event(uuid, text, text, text, text, text, timestamptz, boolean) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
