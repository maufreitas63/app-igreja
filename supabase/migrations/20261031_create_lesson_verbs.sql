-- Conjugação dos verbos de cada lição do Verbum.
-- A lição vive em verbum_lessons.

create table if not exists public.grammar_verbs (
  id serial primary key,
  root_infinitive_en text not null,
  root_infinitive_pt text not null,
  tense_name_en text not null,
  tense_name_pt text not null,
  verb_type text not null default 'REGULAR',
  conjugations jsonb not null,
  created_at timestamptz not null default now(),
  unique (root_infinitive_en, tense_name_en)
);

create table if not exists public.lesson_verbs (
  id serial primary key,
  lesson_id int not null references public.verbum_lessons(id) on delete cascade,
  verb_id int not null references public.grammar_verbs(id) on delete cascade,
  verse_example_en text not null,
  verse_example_pt text not null,
  order_index int not null default 1,
  unique (lesson_id, verb_id)
);

create index if not exists lesson_verbs_lesson_id_idx on public.lesson_verbs (lesson_id);

alter table public.grammar_verbs enable row level security;
alter table public.lesson_verbs enable row level security;

drop policy if exists "Leitura pública de verbos" on public.grammar_verbs;
create policy "Leitura pública de verbos"
  on public.grammar_verbs
  for select
  using (true);

drop policy if exists "Leitura pública de verbos da lição" on public.lesson_verbs;
create policy "Leitura pública de verbos da lição"
  on public.lesson_verbs
  for select
  using (true);

grant select on public.grammar_verbs to anon, authenticated;
grant select on public.lesson_verbs to anon, authenticated;

insert into public.grammar_verbs (
  root_infinitive_en, root_infinitive_pt, tense_name_en, tense_name_pt, verb_type, conjugations
)
values
(
  'to create', 'criar', 'Simple Past', 'Passado Simples', 'REGULAR',
  '[
    {"person":"1s","pronoun_en":"I","form_en":"created","pronoun_pt":"Eu","form_pt":"criei"},
    {"person":"2s","pronoun_en":"You","form_en":"created","pronoun_pt":"Você","form_pt":"criou"},
    {"person":"3s","pronoun_en":"He/She/It","form_en":"created","pronoun_pt":"Ele/Ela","form_pt":"criou"},
    {"person":"1p","pronoun_en":"We","form_en":"created","pronoun_pt":"Nós","form_pt":"criamos"},
    {"person":"2p","pronoun_en":"You","form_en":"created","pronoun_pt":"Vocês","form_pt":"criaram"},
    {"person":"3p","pronoun_en":"They","form_en":"created","pronoun_pt":"Eles/Elas","form_pt":"criaram"}
  ]'::jsonb
),
(
  'to say', 'dizer', 'Simple Past', 'Passado Simples', 'IRREGULAR',
  '[
    {"person":"1s","pronoun_en":"I","form_en":"said","pronoun_pt":"Eu","form_pt":"disse"},
    {"person":"2s","pronoun_en":"You","form_en":"said","pronoun_pt":"Você","form_pt":"disse"},
    {"person":"3s","pronoun_en":"He/She/It","form_en":"said","pronoun_pt":"Ele/Ela","form_pt":"disse"},
    {"person":"1p","pronoun_en":"We","form_en":"said","pronoun_pt":"Nós","form_pt":"dissemos"},
    {"person":"2p","pronoun_en":"You","form_en":"said","pronoun_pt":"Vocês","form_pt":"disseram"},
    {"person":"3p","pronoun_en":"They","form_en":"said","pronoun_pt":"Eles/Elas","form_pt":"disseram"}
  ]'::jsonb
)
on conflict (root_infinitive_en, tense_name_en) do update
  set root_infinitive_pt = excluded.root_infinitive_pt,
      tense_name_pt = excluded.tense_name_pt,
      verb_type = excluded.verb_type,
      conjugations = excluded.conjugations;

insert into public.lesson_verbs (lesson_id, verb_id, verse_example_en, verse_example_pt, order_index)
select l.id, g.id, x.verse_en, x.verse_pt, x.order_index
from (
  values
    ('Beginning and Created', 'to create', 'In the beginning God created the heavens and the earth', 'No princípio criou Deus os céus e a terra', 1),
    ('Beginning and Created', 'to say', 'And God said, Let there be light', 'E disse Deus: Haja luz', 2),
    ('Light, Said and Good', 'to say', 'And God said, Let there be light', 'E disse Deus: Haja luz', 1),
    ('Light, Said and Good', 'to create', 'In the beginning God created the heavens and the earth', 'No princípio criou Deus os céus e a terra', 2)
) as x(title, infinitive, verse_en, verse_pt, order_index)
join public.verbum_lessons l on l.title = x.title
join public.grammar_verbs g on g.root_infinitive_en = x.infinitive and g.tense_name_en = 'Simple Past'
on conflict (lesson_id, verb_id) do update
  set verse_example_en = excluded.verse_example_en,
      verse_example_pt = excluded.verse_example_pt,
      order_index = excluded.order_index;

notify pgrst, 'reload schema';
