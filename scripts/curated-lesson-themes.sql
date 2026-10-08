-- Temas centrais pré-cadastrados da aula, compartilhados entre as instâncias.
-- Aplica: npx supabase db query --linked -f scripts/curated-lesson-themes.sql

create table if not exists public.curated_lesson_themes (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  bible_passage text not null,
  core_lesson text not null,
  activity_suggestion text not null,
  created_at timestamptz not null default now(),
  constraint curated_lesson_themes_category_chk check (
    category in ('identidade', 'carater', 'historias', 'proximo')
  ),
  constraint curated_lesson_themes_title_chk check (length(btrim(title)) >= 2),
  constraint curated_lesson_themes_passage_chk check (length(btrim(bible_passage)) >= 1),
  constraint curated_lesson_themes_core_chk check (length(btrim(core_lesson)) >= 1),
  constraint curated_lesson_themes_activity_chk check (length(btrim(activity_suggestion)) >= 1)
);

create index if not exists curated_lesson_themes_category_idx
  on public.curated_lesson_themes (category, title);

comment on table public.curated_lesson_themes is
  'Catálogo de temas centrais da aula, por eixo temático. Leitura para quem está na sessão do app.';

alter table public.curated_lesson_themes enable row level security;

drop policy if exists curated_lesson_themes_authenticated_read on public.curated_lesson_themes;
create policy curated_lesson_themes_authenticated_read
  on public.curated_lesson_themes
  for select
  to authenticated
  using (true);

-- O app entra com a chave anônima e a sessão nos headers, não com o papel authenticated do Supabase.
drop policy if exists curated_lesson_themes_session_read on public.curated_lesson_themes;
create policy curated_lesson_themes_session_read
  on public.curated_lesson_themes
  for select
  to anon
  using (public.current_session_profile_id() is not null);

revoke all on public.curated_lesson_themes from anon, authenticated, public;
grant select on public.curated_lesson_themes to anon, authenticated;

notify pgrst, 'reload schema';
