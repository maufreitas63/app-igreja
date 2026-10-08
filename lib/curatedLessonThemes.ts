import { supabase } from '@/lib/supabase';
import { parseLessonCategory } from '@/types/class-lesson';
import type { CuratedLessonTheme } from '@/types/lesson-theme';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const parseTheme = (value: unknown): CuratedLessonTheme | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();
  const category = parseLessonCategory(row.category);
  const title = String(row.title ?? '').trim();

  if (!id || !category || title.length < 2) {
    return null;
  }

  return {
    id,
    category,
    title,
    bible_passage: String(row.bible_passage ?? '').trim(),
    core_lesson: String(row.core_lesson ?? '').trim(),
    activity_suggestion: String(row.activity_suggestion ?? '').trim(),
    created_at: String(row.created_at ?? '').trim() || undefined,
  };
};

export async function listCuratedLessonThemes(): Promise<CuratedLessonTheme[]> {
  const { data, error } = await supabase
    .from('curated_lesson_themes')
    .select('id, category, title, bible_passage, core_lesson, activity_suggestion, created_at')
    .order('title', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Não foi possível carregar os temas da aula.');
  }

  return (Array.isArray(data) ? data : [])
    .map(parseTheme)
    .filter((theme): theme is CuratedLessonTheme => theme !== null);
}
