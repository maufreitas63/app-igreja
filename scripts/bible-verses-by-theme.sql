-- Versículos da Bíblia por tema (fonte: https://dailyverses.net/pt/temas)
-- Execute no Supabase SQL Editor, depois rode bible-verses-by-theme-data.sql

CREATE TABLE IF NOT EXISTS public.bible_themes (
  id         bigserial PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bible_verses_by_theme (
  id            bigserial PRIMARY KEY,
  theme_slug    text NOT NULL REFERENCES public.bible_themes (slug) ON DELETE CASCADE,
  texto         text NOT NULL,
  referencia    text NOT NULL,
  livro         text NOT NULL,
  capitulo      integer,
  versiculo     integer,
  versiculo_fim integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bible_verses_by_theme_ref_check CHECK (
    capitulo IS NULL OR capitulo > 0
  ),
  CONSTRAINT bible_verses_by_theme_vers_check CHECK (
    versiculo IS NULL OR versiculo > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_by_theme_slug
  ON public.bible_verses_by_theme (theme_slug);

CREATE INDEX IF NOT EXISTS idx_bible_verses_by_theme_livro
  ON public.bible_verses_by_theme (livro, capitulo, versiculo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bible_verses_by_theme_slug_ref
  ON public.bible_verses_by_theme (theme_slug, referencia);

CREATE OR REPLACE VIEW public.bible_verses_by_theme_v AS
SELECT
  v.id,
  t.slug   AS theme_slug,
  t.name   AS theme_name,
  v.texto,
  v.referencia,
  v.livro,
  v.capitulo,
  v.versiculo,
  v.versiculo_fim
FROM public.bible_verses_by_theme v
JOIN public.bible_themes t ON t.slug = v.theme_slug;

COMMENT ON VIEW public.bible_verses_by_theme_v IS
  'Versículos por tema com nome legível do tema';

COMMENT ON TABLE public.bible_themes IS
  'Temas bíblicos importados de dailyverses.net/pt/temas';

COMMENT ON TABLE public.bible_verses_by_theme IS
  'Versículos agrupados por tema (texto, livro, capítulo, versículo)';

COMMENT ON COLUMN public.bible_verses_by_theme.referencia IS
  'Referência original do site, ex.: João 15:18 ou 1 Coríntios 13:6-7';

COMMENT ON COLUMN public.bible_verses_by_theme.versiculo_fim IS
  'Versículo final quando a referência é um intervalo (ex.: 6-7)';

-- Leitura pública (ajuste RLS conforme política da igreja)
ALTER TABLE public.bible_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_verses_by_theme ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bible_themes_select_all ON public.bible_themes;
CREATE POLICY bible_themes_select_all ON public.bible_themes
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS bible_verses_by_theme_select_all ON public.bible_verses_by_theme;
CREATE POLICY bible_verses_by_theme_select_all ON public.bible_verses_by_theme
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE OR REPLACE FUNCTION public.get_random_bible_verse()
RETURNS TABLE (
  theme_slug    text,
  theme_name    text,
  texto         text,
  referencia    text,
  livro         text,
  capitulo      integer,
  versiculo     integer,
  versiculo_fim integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.theme_slug,
    t.name AS theme_name,
    v.texto,
    v.referencia,
    v.livro,
    v.capitulo,
    v.versiculo,
    v.versiculo_fim
  FROM public.bible_verses_by_theme v
  JOIN public.bible_themes t ON t.slug = v.theme_slug
  ORDER BY random()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_bible_verse() TO anon, authenticated;

COMMENT ON FUNCTION public.get_random_bible_verse() IS
  'Retorna um versículo aleatório com tema para o índice do aplicativo';
