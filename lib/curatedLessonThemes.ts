import { saveClassLesson } from '@/lib/classLessonApi';
import { suggestClassLessonFamily } from '@/lib/classLessonFamilyApi';
import { getEventCalendarDate } from '@/lib/eventDate';
import { supabase } from '@/lib/supabase';
import type { ClassRoomKey } from '@/types/class-lesson';
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

export async function applyCuratedLessonTheme(input: {
  eventId: string;
  eventDate: string | null;
  rooms: { key: ClassRoomKey; label: string }[];
  theme: CuratedLessonTheme;
}): Promise<{ savedLabels: string[]; failedLabels: string[] }> {
  if (input.rooms.length === 0) {
    throw new Error('Marque Infantil ou Jovens para incluir o tema.');
  }

  const classDate = getEventCalendarDate(input.eventDate) ?? '';
  const settled = await Promise.allSettled(
    input.rooms.map(async (room) => {
      const familyExtension = await suggestClassLessonFamily({
        eventId: input.eventId,
        roomKey: room.key,
        roomLabel: room.label,
        title: input.theme.title,
        biblePassage: input.theme.bible_passage,
        mainObjective: input.theme.core_lesson,
      });

      await saveClassLesson(input.eventId, room.key, {
        title: input.theme.title,
        bible_passage: input.theme.bible_passage,
        main_objective: input.theme.core_lesson,
        resources_notes: input.theme.activity_suggestion,
        family_extension: familyExtension,
        class_date: classDate,
        category: input.theme.category,
      });

      return room.label;
    })
  );

  const savedLabels = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const failedLabels = input.rooms
    .filter((_, index) => settled[index]?.status === 'rejected')
    .map((room) => room.label);

  if (savedLabels.length === 0) {
    const reason = settled.find((result) => result.status === 'rejected');
    throw new Error(
      reason?.status === 'rejected' && reason.reason instanceof Error
        ? reason.reason.message
        : 'Não foi possível incluir o tema no planejamento.'
    );
  }

  return { savedLabels, failedLabels };
}
