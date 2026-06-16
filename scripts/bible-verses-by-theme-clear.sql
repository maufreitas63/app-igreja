-- Limpa todos os dados de versículos por tema no Supabase.
-- Execute ANTES de reimportar (00-truncate-themes.sql + partes 01–14 ou npm run apply:bible-verses).
--
-- Mantém: tabelas, índices, view bible_verses_by_theme_v, RLS e RPC get_random_bible_verse().
-- Remove apenas linhas de public.bible_themes e public.bible_verses_by_theme.

BEGIN;

TRUNCATE TABLE public.bible_verses_by_theme RESTART IDENTITY;
TRUNCATE TABLE public.bible_themes RESTART IDENTITY CASCADE;

SELECT
  (SELECT COUNT(*)::int FROM public.bible_themes) AS temas_restantes,
  (SELECT COUNT(*)::int FROM public.bible_verses_by_theme) AS versiculos_restantes;

COMMIT;
