-- Trilha da Unidade 1: seções, nós e lições curtas.
begin;

insert into public.verbum_course_sections (cefr_level, order_index, title, description, color_hex)
values ('A1', 1, 'Seção 1: O Princípio — Nível A1', 'A criação contada em inglês, do princípio ao descanso.', '#10b981')
on conflict (order_index) do update
  set cefr_level = excluded.cefr_level,
      title = excluded.title,
      description = excluded.description,
      color_hex = excluded.color_hex;
insert into public.verbum_course_sections (cefr_level, order_index, title, description, color_hex)
values ('A2', 2, 'Seção 2: A Saída — Nível A2', 'Deus revela o seu nome e envia Moisés.', '#2563eb')
on conflict (order_index) do update
  set cefr_level = excluded.cefr_level,
      title = excluded.title,
      description = excluded.description,
      color_hex = excluded.color_hex;

insert into public.verbum_curriculum_units (
  bible_book_id, division, cefr_level, order_index, title, theological_theme, icon_name
)
select b.id, b.division, 'A2', 1, 'Unidade 2: I AM (Êxodo 3)', 'O nome de Deus revelado a Moisés', 'scroll'
from public.verbum_bible_books b
where b.order_index = 2
  and not exists (
    select 1 from public.verbum_curriculum_units u
    where u.bible_book_id = b.id and u.order_index = 1
  );

update public.verbum_curriculum_units u
set title = 'Unidade 1: The Voice of Creation (Gênesis 1-2)',
    theological_theme = 'A palavra que cria, separa, anima, faz à imagem e descansa',
    cefr_level = 'A1',
    section_id = (select id from public.verbum_course_sections where order_index = 1)
from public.verbum_bible_books b
where u.bible_book_id = b.id and b.order_index = 1 and u.order_index = 1;
update public.verbum_curriculum_units u
set title = 'Unidade 2: I AM (Êxodo 3)',
    theological_theme = 'O nome de Deus revelado a Moisés',
    cefr_level = 'A2',
    section_id = (select id from public.verbum_course_sections where order_index = 2)
from public.verbum_bible_books b
where u.bible_book_id = b.id and b.order_index = 2 and u.order_index = 1;

delete from public.verbum_unit_crowns c
using public.verbum_curriculum_units u, public.verbum_bible_books b
where c.unit_id = u.id and u.bible_book_id = b.id and u.order_index = 1 and b.order_index in (1, 2);
delete from public.verbum_lessons l
using public.verbum_curriculum_units u, public.verbum_bible_books b
where l.unit_id = u.id and u.bible_book_id = b.id and u.order_index = 1 and b.order_index in (1, 2);
delete from public.verbum_path_nodes n
using public.verbum_curriculum_units u, public.verbum_bible_books b
where n.unit_id = u.id and u.bible_book_id = b.id and u.order_index = 1 and b.order_index in (1, 2);

insert into public.verbum_path_nodes (unit_id, order_index, node_type, title, total_levels)
select u.id, 1, 'LESSON', 'Let There Be Light', 3
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1;
insert into public.verbum_path_nodes (unit_id, order_index, node_type, title, total_levels)
select u.id, 2, 'LESSON', 'Sky, Waters and Firmament', 3
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1;
insert into public.verbum_path_nodes (unit_id, order_index, node_type, title, total_levels)
select u.id, 3, 'LESSON', 'Living Creatures of Land and Sea', 3
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1;
insert into public.verbum_path_nodes (unit_id, order_index, node_type, title, total_levels)
select u.id, 4, 'LESSON', 'Image and Likeness', 3
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1;
insert into public.verbum_path_nodes (unit_id, order_index, node_type, title, total_levels)
select u.id, 5, 'UNIT_BOSS', 'The Sabbath Rest', 1
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1;
insert into public.verbum_path_nodes (unit_id, order_index, node_type, title, total_levels)
select u.id, 1, 'LESSON', 'I AM the Lord', 1
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1;

insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 1, 1, 'Beginning and Created', 15, 5, 'No princípio Deus cria. Beginning e created abrem a história.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"pairs":[{"en":"Beginning","pt":"Princípio"},{"en":"Created","pt":"Criou"},{"en":"Heavens","pt":"Céus"},{"en":"Earth","pt":"Terra"}],"lemma":"Beginning"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"sentence":"In the _____ God created the heavens and the earth.","options":["beginning","end","middle"],"answer":"beginning","lemma":"beginning"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"shuffled":["the","beginning","God","created","In"],"answer":["In","the","beginning","God","created"],"lemma":"beginning"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"sentence":"God _____ the heavens and the earth.","options":["created","hid","bought"],"answer":"created","lemma":"created"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"pairs":[{"en":"God","pt":"Deus"},{"en":"Said","pt":"Disse"},{"en":"Light","pt":"Luz"},{"en":"Good","pt":"Bom"}],"lemma":"God"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"shuffled":["created","the","heavens","God"],"answer":["God","created","the","heavens"],"lemma":"heavens"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"sentence":"And God saw that it was _____.","options":["good","bad","void"],"answer":"good","lemma":"good"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"shuffled":["created","the","earth","God"],"answer":["God","created","the","earth"],"lemma":"earth"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 2, 2, 'Heavens and Earth', 15, 5, 'Céus e terra recebem nome. Heavens e earth são o cenário da criação.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"pairs":[{"en":"Heavens","pt":"Céus"},{"en":"Earth","pt":"Terra"},{"en":"Beginning","pt":"Princípio"},{"en":"Created","pt":"Criou"}],"lemma":"Heavens"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"sentence":"God created the _____ and the earth.","options":["heavens","rivers","houses"],"answer":"heavens","lemma":"heavens"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"shuffled":["created","the","heavens","and","the","earth","God"],"answer":["God","created","the","heavens","and","the","earth"],"lemma":"earth"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"sentence":"Darkness was upon the _____.","options":["deep","hill","wall"],"answer":"deep","lemma":"deep"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"pairs":[{"en":"Darkness","pt":"Escuridão"},{"en":"Deep","pt":"Abismo"},{"en":"God","pt":"Deus"},{"en":"Light","pt":"Luz"}],"lemma":"Darkness"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"shuffled":["was","upon","the","deep","Darkness"],"answer":["Darkness","was","upon","the","deep"],"lemma":"darkness"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"sentence":"The earth was without _____.","options":["form","gold","rain"],"answer":"form","lemma":"form"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"shuffled":["the","beginning","God","created","In"],"answer":["In","the","beginning","God","created"],"lemma":"created"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 2;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 3, 3, 'Light, Said and Good', 15, 5, 'Deus fala e a luz existe. Said, light e good andam juntos.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"pairs":[{"en":"Light","pt":"Luz"},{"en":"Said","pt":"Disse"},{"en":"Good","pt":"Bom"},{"en":"Darkness","pt":"Escuridão"}],"lemma":"Light"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"sentence":"Let there be _____.","options":["light","night","dust"],"answer":"light","lemma":"light"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"shuffled":["God","said","Let","there","be","light","And"],"answer":["And","God","said","Let","there","be","light"],"lemma":"said"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"sentence":"And God _____ , Let there be light.","options":["said","ate","ran"],"answer":"said","lemma":"said"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"pairs":[{"en":"God","pt":"Deus"},{"en":"Created","pt":"Criou"},{"en":"Earth","pt":"Terra"},{"en":"Heavens","pt":"Céus"}],"lemma":"God"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"shuffled":["saw","the","light","God"],"answer":["God","saw","the","light"],"lemma":"light"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"sentence":"And there was _____.","options":["light","rain","snow"],"answer":"light","lemma":"light"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:3', 'And God said, Let there be light: and there was light.', 'E disse Deus: Haja luz. E houve luz.', '{"shuffled":["light","was","good","the"],"answer":["the","light","was","good"],"lemma":"good"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 1 and l.level_index = 3;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 4, 1, 'God Divided the Waters', 15, 5, 'Deus separa as águas. Divided é o verbo da separação.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"pairs":[{"en":"Waters","pt":"Águas"},{"en":"Divided","pt":"Separou"},{"en":"Sky","pt":"Céu"},{"en":"Firmament","pt":"Firmamento"}],"lemma":"Waters"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"sentence":"God _____ the waters.","options":["divided","mixed","hid"],"answer":"divided","lemma":"divided"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"shuffled":["divided","the","waters","God"],"answer":["God","divided","the","waters"],"lemma":"divided"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"sentence":"Let there be a _____ in the midst of the waters.","options":["firmament","garden","city"],"answer":"firmament","lemma":"firmament"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"pairs":[{"en":"Above","pt":"Acima"},{"en":"Below","pt":"Abaixo"},{"en":"Called","pt":"Chamou"},{"en":"God","pt":"Deus"}],"lemma":"Above"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"shuffled":["there","be","a","firmament","Let"],"answer":["Let","there","be","a","firmament"],"lemma":"firmament"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"sentence":"God called the firmament _____.","options":["Heaven","Night","Sea"],"answer":"Heaven","lemma":"heaven"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:6', 'And God said, Let there be a firmament in the midst of the waters.', 'E disse Deus: Haja um firmamento no meio das águas.', '{"shuffled":["called","the","firmament","Heaven","God"],"answer":["God","called","the","firmament","Heaven"],"lemma":"called"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 1;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 5, 2, 'Above and Below', 15, 5, 'O céu fica acima e as águas abaixo. Above e below marcam o lugar.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"pairs":[{"en":"Above","pt":"Acima"},{"en":"Below","pt":"Abaixo"},{"en":"Under","pt":"Debaixo"},{"en":"Waters","pt":"Águas"}],"lemma":"Above"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"sentence":"The sky is _____ the waters.","options":["above","below","inside"],"answer":"above","lemma":"above"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"shuffled":["sky","is","above","the","waters","The"],"answer":["The","sky","is","above","the","waters"],"lemma":"above"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"sentence":"The deep waters stayed _____.","options":["below","above","before"],"answer":"below","lemma":"below"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"pairs":[{"en":"Sky","pt":"Céu"},{"en":"Divided","pt":"Separou"},{"en":"Firmament","pt":"Firmamento"},{"en":"Called","pt":"Chamou"}],"lemma":"Sky"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"shuffled":["waters","were","below","the","sky","The"],"answer":["The","waters","were","below","the","sky"],"lemma":"below"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"sentence":"God divided the waters _____ the firmament.","options":["under","after","without"],"answer":"under","lemma":"under"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:7', 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.', 'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.', '{"shuffled":["divided","the","waters","God"],"answer":["God","divided","the","waters"],"lemma":"divided"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 2;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 6, 3, 'Day and Night', 15, 5, 'Deus chama a luz de dia e as trevas de noite.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"pairs":[{"en":"Day","pt":"Dia"},{"en":"Night","pt":"Noite"},{"en":"Called","pt":"Chamou"},{"en":"Light","pt":"Luz"}],"lemma":"Day"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"sentence":"God called the light _____.","options":["Day","Night","Sea"],"answer":"Day","lemma":"day"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"shuffled":["called","the","light","Day","God"],"answer":["God","called","the","light","Day"],"lemma":"day"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"sentence":"The darkness he called _____.","options":["Night","Day","Sky"],"answer":"Night","lemma":"night"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"pairs":[{"en":"Darkness","pt":"Escuridão"},{"en":"God","pt":"Deus"},{"en":"Sky","pt":"Céu"},{"en":"Waters","pt":"Águas"}],"lemma":"Darkness"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"shuffled":["darkness","he","called","Night","the"],"answer":["the","darkness","he","called","Night"],"lemma":"night"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"sentence":"And God _____ the light Day.","options":["called","lost","broke"],"answer":"called","lemma":"called"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:5', 'And God called the light Day, and the darkness he called Night.', 'E Deus chamou à luz Dia; e às trevas chamou Noite.', '{"shuffled":["the","evening","and","the","morning","And"],"answer":["And","the","evening","and","the","morning"],"lemma":"called"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 2 and l.level_index = 3;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 7, 1, 'Birds and Fish', 15, 5, 'Pássaros e peixes enchem o céu e o mar. Os plurais nomeiam a vida.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"pairs":[{"en":"Birds","pt":"Pássaros"},{"en":"Fish","pt":"Peixes"},{"en":"Sea","pt":"Mar"},{"en":"Fly","pt":"Voar"}],"lemma":"Birds"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"sentence":"God created the _____ that fly.","options":["birds","stones","walls"],"answer":"birds","lemma":"birds"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"shuffled":["created","the","birds","God"],"answer":["God","created","the","birds"],"lemma":"birds"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"sentence":"The _____ live in the sea.","options":["fish","lamps","hills"],"answer":"fish","lemma":"fish"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"pairs":[{"en":"Creatures","pt":"Criaturas"},{"en":"Earth","pt":"Terra"},{"en":"Waters","pt":"Águas"},{"en":"God","pt":"Deus"}],"lemma":"Creatures"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"shuffled":["live","in","the","sea","Fish"],"answer":["Fish","live","in","the","sea"],"lemma":"fish"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"sentence":"Birds fly above the _____.","options":["earth","night","word"],"answer":"earth","lemma":"earth"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:20', 'Let the waters bring forth the moving creature, and fowl that may fly above the earth.', 'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.', '{"shuffled":["fly","above","the","earth","Birds"],"answer":["Birds","fly","above","the","earth"],"lemma":"birds"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 1;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 8, 2, 'The Sea and Living Creatures', 15, 5, 'O mar se enche de criaturas vivas. Sea e creatures crescem juntos.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"pairs":[{"en":"Sea","pt":"Mar"},{"en":"Creatures","pt":"Criaturas"},{"en":"Living","pt":"Vivas"},{"en":"Whales","pt":"Baleias"}],"lemma":"Sea"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"sentence":"God created every living _____.","options":["creature","house","stone"],"answer":"creature","lemma":"creature"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"shuffled":["created","every","living","creature","God"],"answer":["God","created","every","living","creature"],"lemma":"creature"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"sentence":"The waters brought forth living _____.","options":["creatures","crowns","gates"],"answer":"creatures","lemma":"creatures"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"pairs":[{"en":"Fish","pt":"Peixes"},{"en":"Birds","pt":"Pássaros"},{"en":"Waters","pt":"Águas"},{"en":"God","pt":"Deus"}],"lemma":"Fish"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"shuffled":["creatures","filled","the","sea","living"],"answer":["living","creatures","filled","the","sea"],"lemma":"sea"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"sentence":"Great whales live in the _____.","options":["sea","tent","field"],"answer":"sea","lemma":"sea"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:21', 'And God created great whales, and every living creature that moveth.', 'E Deus criou as grandes baleias, e todo réptil de alma vivente.', '{"shuffled":["waters","brought","forth","life","The"],"answer":["The","waters","brought","forth","life"],"lemma":"waters"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 2;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 9, 3, 'Cattle and Creeping Things', 15, 5, 'Gado e répteis enchem a terra. Os plurais da terra.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"pairs":[{"en":"Cattle","pt":"Gado"},{"en":"Creeping","pt":"Répteis"},{"en":"Beast","pt":"Animal"},{"en":"Earth","pt":"Terra"}],"lemma":"Cattle"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"sentence":"Let the earth bring forth the _____.","options":["cattle","crowns","lamps"],"answer":"cattle","lemma":"cattle"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"shuffled":["the","earth","bring","forth","cattle","Let"],"answer":["Let","the","earth","bring","forth","cattle"],"lemma":"cattle"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"sentence":"Creeping things move on the _____.","options":["earth","sky","word"],"answer":"earth","lemma":"earth"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"pairs":[{"en":"Animals","pt":"Animais"},{"en":"Birds","pt":"Pássaros"},{"en":"Fish","pt":"Peixes"},{"en":"Sea","pt":"Mar"}],"lemma":"Animals"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"shuffled":["things","move","on","the","earth","creeping"],"answer":["creeping","things","move","on","the","earth"],"lemma":"creeping"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"sentence":"God made the _____ of the earth.","options":["animals","altars","angels"],"answer":"animals","lemma":"animals"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:24', 'Let the earth bring forth the living creature, cattle, and creeping thing.', 'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.', '{"shuffled":["made","the","animals","God"],"answer":["God","made","the","animals"],"lemma":"animals"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 3 and l.level_index = 3;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 10, 1, 'In Our Image', 15, 5, 'Deus fala no plural: façamos o homem à nossa imagem. Our aponta para Deus.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"pairs":[{"en":"Man","pt":"Homem"},{"en":"Image","pt":"Imagem"},{"en":"Our","pt":"Nossa"},{"en":"Us","pt":"Nós"}],"lemma":"Man"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"sentence":"Let us make man in _____ image.","options":["our","my","your"],"answer":"our","lemma":"our"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"shuffled":["us","make","man","Let"],"answer":["Let","us","make","man"],"lemma":"man"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"sentence":"God said, Let _____ make man.","options":["us","me","them"],"answer":"us","lemma":"us"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"pairs":[{"en":"God","pt":"Deus"},{"en":"Likeness","pt":"Semelhança"},{"en":"Make","pt":"Façamos"},{"en":"Said","pt":"Disse"}],"lemma":"God"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"shuffled":["our","image","in"],"answer":["in","our","image"],"lemma":"image"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"sentence":"Man is made in the _____ of God.","options":["image","house","garden"],"answer":"image","lemma":"image"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:26', 'And God said, Let us make man in our image, after our likeness.', 'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.', '{"shuffled":["said","Let","us","make","man","God"],"answer":["God","said","Let","us","make","man"],"lemma":"said"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 1;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 11, 2, 'Likeness and Rule', 15, 5, 'Semelhança e domínio. Likeness e rule mostram o chamado humano.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"pairs":[{"en":"Likeness","pt":"Semelhança"},{"en":"Rule","pt":"Domínio"},{"en":"Them","pt":"Eles"},{"en":"His","pt":"Seu"}],"lemma":"Likeness"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"sentence":"Man is made after Gods _____.","options":["likeness","shadow","city"],"answer":"likeness","lemma":"likeness"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"shuffled":["our","likeness","after"],"answer":["after","our","likeness"],"lemma":"likeness"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"sentence":"Let them _____ over the fish of the sea.","options":["rule","sleep","fall"],"answer":"rule","lemma":"rule"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"pairs":[{"en":"Fish","pt":"Peixes"},{"en":"Sea","pt":"Mar"},{"en":"Man","pt":"Homem"},{"en":"Image","pt":"Imagem"}],"lemma":"Fish"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"shuffled":["them","rule","the","fish","Let"],"answer":["Let","them","rule","the","fish"],"lemma":"rule"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"sentence":"God created man in _____ own image.","options":["his","her","their"],"answer":"his","lemma":"his"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:26', 'And let them have dominion over the fish of the sea.', 'E domine sobre os peixes do mar.', '{"shuffled":["his","own","image","in"],"answer":["in","his","own","image"],"lemma":"his"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 2;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 12, 3, 'Blessed and Fruitful', 15, 5, 'Deus abençoa o homem e a mulher. Blessed e fruitful são a missão.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"pairs":[{"en":"Blessed","pt":"Abençoou"},{"en":"Fruitful","pt":"Frutificai"},{"en":"Them","pt":"Eles"},{"en":"Multiply","pt":"Multiplicai"}],"lemma":"Blessed"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"sentence":"God _____ them.","options":["blessed","forgot","sold"],"answer":"blessed","lemma":"blessed"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"shuffled":["blessed","them","God"],"answer":["God","blessed","them"],"lemma":"blessed"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"sentence":"Be _____ and multiply.","options":["fruitful","silent","empty"],"answer":"fruitful","lemma":"fruitful"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"pairs":[{"en":"God","pt":"Deus"},{"en":"Man","pt":"Homem"},{"en":"Image","pt":"Imagem"},{"en":"Rule","pt":"Domínio"}],"lemma":"God"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"shuffled":["fruitful","and","multiply","Be"],"answer":["Be","fruitful","and","multiply"],"lemma":"fruitful"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"sentence":"God said unto _____.","options":["them","it","me"],"answer":"them","lemma":"them"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:28', 'And God blessed them, and God said unto them, Be fruitful, and multiply.', 'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.', '{"shuffled":["said","unto","them","God"],"answer":["God","said","unto","them"],"lemma":"them"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 4 and l.level_index = 3;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 13, 1, 'The Seventh Day', 40, 50, 'Deus descansa, abençoa o sétimo dia e coroa a unidade.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 2:2', 'And on the seventh day God ended his work and he rested.', 'E no sétimo dia Deus acabou a sua obra e descansou.', '{"pairs":[{"en":"Rested","pt":"Descansou"},{"en":"Seventh","pt":"Sétimo"},{"en":"Blessed","pt":"Abençoou"},{"en":"Day","pt":"Dia"}],"lemma":"rested"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 2:2', 'And he rested on the seventh day from all his work.', 'E descansou no sétimo dia de toda a sua obra.', '{"sentence":"On the seventh day God _____.","options":["rested","ran","forgot"],"answer":"rested","lemma":"rested"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 2:2', 'God rested on the seventh day.', 'Deus descansou no sétimo dia.', '{"shuffled":["rested","on","the","seventh","day","God"],"answer":["God","rested","on","the","seventh","day"],"lemma":"rested"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 2:3', 'And God blessed the seventh day.', 'E abençoou Deus o dia sétimo.', '{"sentence":"God _____ the seventh day.","options":["blessed","broke","hid"],"answer":"blessed","lemma":"blessed"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 2:3', 'God blessed the seventh day.', 'Deus abençoou o sétimo dia.', '{"shuffled":["blessed","the","seventh","day","God"],"answer":["God","blessed","the","seventh","day"],"lemma":"blessed"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 2:1', 'Thus the heavens and the earth were finished.', 'Assim os céus e a terra foram acabados.', '{"sentence":"The heavens and the earth were _____.","options":["finished","empty","lost"],"answer":"finished","lemma":"finished"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.', '{"shuffled":["the","beginning","God","created","In"],"answer":["In","the","beginning","God","created"],"lemma":"created"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:27', 'So God created man in his own image.', 'E criou Deus o homem à sua imagem.', '{"sentence":"God made man in his _____.","options":["image","tent","river"],"answer":"image","lemma":"image"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 1:4', 'And God saw the light, that it was good.', 'E viu Deus que era boa a luz.', '{"pairs":[{"en":"Light","pt":"Luz"},{"en":"Waters","pt":"Águas"},{"en":"Birds","pt":"Pássaros"},{"en":"Good","pt":"Bom"}],"lemma":"light"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:3', 'And God said, Let there be light.', 'E disse Deus: Haja luz.', '{"shuffled":["God","said","Let","there","be","light","And"],"answer":["And","God","said","Let","there","be","light"],"lemma":"said"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:7', 'The waters which were above the firmament.', 'As águas que estavam sobre o firmamento.', '{"sentence":"The sky is _____ the waters.","options":["above","below","after"],"answer":"above","lemma":"above"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:7', 'And divided the waters.', 'E separou as águas.', '{"shuffled":["divided","the","waters","God"],"answer":["God","divided","the","waters"],"lemma":"divided"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Genesis 1:28', 'Be fruitful, and multiply.', 'Frutificai e multiplicai-vos.', '{"sentence":"Be _____ and multiply.","options":["fruitful","silent","empty"],"answer":"fruitful","lemma":"fruitful"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Genesis 1:28', 'And God blessed them.', 'E Deus os abençoou.', '{"shuffled":["blessed","them","God"],"answer":["God","blessed","them"],"lemma":"blessed"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Genesis 2:1', 'Thus the heavens and the earth were finished.', 'Assim os céus e a terra foram acabados.', '{"pairs":[{"en":"Earth","pt":"Terra"},{"en":"Sea","pt":"Mar"},{"en":"Image","pt":"Imagem"},{"en":"Night","pt":"Noite"}],"lemma":"earth"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 1 and u.order_index = 1 and n.order_index = 5 and l.level_index = 1;
insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, 1, 1, 'I AM hath sent me', 15, 10, 'Deus diz o seu nome: I AM. O envio de Moisés começa aqui.'
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"pairs":[{"en":"Lord","pt":"Senhor"},{"en":"Name","pt":"Nome"},{"en":"Sent","pt":"Enviou"},{"en":"People","pt":"Povo"}],"lemma":"Lord"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"sentence":"I _____ that I AM.","options":["AM","is","are"],"answer":"AM","lemma":"am"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"shuffled":["AM","the","Lord","I"],"answer":["I","AM","the","Lord"],"lemma":"lord"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"sentence":"God _____ Moses.","options":["sent","sold","shut"],"answer":"sent","lemma":"sent"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'MATCH_PAIRS', 'Ligue cada palavra ao sentido.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"pairs":[{"en":"Moses","pt":"Moisés"},{"en":"God","pt":"Deus"},{"en":"AM","pt":"SOU"},{"en":"Said","pt":"Disse"}],"lemma":"Moses"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"shuffled":["sent","Moses","God"],"answer":["God","sent","Moses"],"lemma":"sent"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'FILL_BLANK', 'Complete o versículo.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"sentence":"Go to my _____.","options":["people","palace","river"],"answer":"people","lemma":"people"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;
insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, 'ORDER_WORDS', 'Monte a frase na ordem do versículo.', 'Exodus 3:14', 'And God said unto Moses, I AM THAT I AM.', 'E disse Deus a Moisés: EU SOU O QUE SOU.', '{"shuffled":["AM","hath","sent","me","I"],"answer":["I","AM","hath","sent","me"],"lemma":"sent"}'::jsonb
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = 2 and u.order_index = 1 and n.order_index = 1 and l.level_index = 1;

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

commit;
select b.order_index as book, n.order_index as node, count(distinct l.id) as lessons, count(e.id) as exercises
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
left join public.verbum_lessons l on l.node_id = n.id
left join public.verbum_exercises e on e.lesson_id = l.id
where b.order_index in (1, 2) and u.order_index = 1
group by b.order_index, n.order_index
order by b.order_index, n.order_index;
