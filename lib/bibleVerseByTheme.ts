import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export type BibleVerseByTheme = {
  theme_slug: string;
  theme_name: string;
  texto: string;
  referencia: string;
  livro: string;
  capitulo: number | null;
  versiculo: number | null;
  versiculo_fim: number | null;
};

const BIBLE_VERSE_VIEW = 'bible_verses_by_theme_v';

const mapBibleVerseRow = (row: Record<string, unknown> | null | undefined): BibleVerseByTheme | null => {
  if (!row || typeof row.theme_name !== 'string' || typeof row.texto !== 'string') {
    return null;
  }

  return {
    theme_slug: String(row.theme_slug ?? ''),
    theme_name: row.theme_name,
    texto: row.texto,
    referencia: String(row.referencia ?? ''),
    livro: String(row.livro ?? ''),
    capitulo: typeof row.capitulo === 'number' ? row.capitulo : null,
    versiculo: typeof row.versiculo === 'number' ? row.versiculo : null,
    versiculo_fim: typeof row.versiculo_fim === 'number' ? row.versiculo_fim : null,
  };
};

export const formatBibleVerseReference = (
  verse: Pick<BibleVerseByTheme, 'livro' | 'capitulo' | 'versiculo' | 'versiculo_fim' | 'referencia'>
) => {
  if (verse.capitulo != null && verse.versiculo != null) {
    const range =
      verse.versiculo_fim != null && verse.versiculo_fim !== verse.versiculo
        ? `${verse.versiculo}-${verse.versiculo_fim}`
        : `${verse.versiculo}`;
    return `${verse.livro} ${verse.capitulo}:${range}`;
  }

  return verse.referencia;
};

async function fetchRandomBibleVerseFromView(): Promise<BibleVerseByTheme | null> {
  const { count, error: countError } = await supabase
    .from(BIBLE_VERSE_VIEW)
    .select('id', { count: 'exact', head: true });

  if (countError || !count || count <= 0) {
    return null;
  }

  const offset = Math.floor(Math.random() * count);
  const { data, error } = await supabase
    .from(BIBLE_VERSE_VIEW)
    .select('theme_slug, theme_name, texto, referencia, livro, capitulo, versiculo, versiculo_fim')
    .range(offset, offset);

  if (error) {
    throw error;
  }

  return mapBibleVerseRow(data?.[0] as Record<string, unknown> | undefined);
}

export async function fetchRandomBibleVerseByTheme(): Promise<BibleVerseByTheme | null> {
  const { data, error } = await supabase.rpc('get_random_bible_verse');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_random_bible_verse')) {
      return fetchRandomBibleVerseFromView();
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return mapBibleVerseRow(row as Record<string, unknown> | undefined);
}
