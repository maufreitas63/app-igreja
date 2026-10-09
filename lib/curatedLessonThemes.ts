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

type LessonThemeWriteListener = (write: { eventId: string }) => void;

const lessonThemeWriteListeners = new Set<LessonThemeWriteListener>();

export function subscribeLessonThemeWrites(listener: LessonThemeWriteListener) {
  lessonThemeWriteListeners.add(listener);
  return () => {
    lessonThemeWriteListeners.delete(listener);
  };
}

const notifyLessonThemeWrite = (eventId: string) => {
  lessonThemeWriteListeners.forEach((listener) => listener({ eventId }));
};

export type AppliedLessonTheme = {
  savedLabels: string[];
  failedLabels: string[];
  familyLabels: string[];
};

export function lessonThemeApplyMessage(applied: AppliedLessonTheme) {
  const saved = applied.savedLabels.join(' e ');
  const familyReady =
    applied.savedLabels.length > 0 && applied.familyLabels.length === applied.savedLabels.length;

  if (applied.failedLabels.length > 0) {
    return {
      type: 'error' as const,
      text2: `Tema gravado em ${saved}. Não foi possível concluir ${applied.failedLabels.join(' e ')}.`,
    };
  }

  if (!familyReady) {
    return {
      type: 'success' as const,
      text2: `Tema gravado em ${saved}. A conversa em família não foi gerada.`,
    };
  }

  return {
    type: 'success' as const,
    text2: `Tema e conversa em família gravados em ${saved}.`,
  };
}

export async function applyCuratedLessonTheme(input: {
  eventId: string;
  eventDate: string | null;
  rooms: { key: ClassRoomKey; label: string }[];
  theme: CuratedLessonTheme;
}): Promise<AppliedLessonTheme> {
  if (input.rooms.length === 0) {
    throw new Error('Não há sala infantil ou de jovens para incluir o tema.');
  }

  const classDate = getEventCalendarDate(input.eventDate) ?? '';
  const settled = await Promise.allSettled(
    input.rooms.map(async (room) => {
      const lesson = {
        title: input.theme.title,
        bible_passage: input.theme.bible_passage,
        main_objective: input.theme.core_lesson,
        resources_notes: input.theme.activity_suggestion,
        class_date: classDate,
        category: input.theme.category,
      };

      await saveClassLesson(input.eventId, room.key, {
        ...lesson,
        family_extension: '',
      });

      try {
        const familyExtension = await suggestClassLessonFamily({
          eventId: input.eventId,
          roomKey: room.key,
          roomLabel: room.label,
          title: input.theme.title,
          biblePassage: input.theme.bible_passage,
          mainObjective: input.theme.core_lesson,
        });

        if (familyExtension.trim()) {
          await saveClassLesson(input.eventId, room.key, {
            ...lesson,
            family_extension: familyExtension,
          });
          return { label: room.label, familyOk: true };
        }
      } catch {
        // O tema da sala já foi gravado. A conversa em família fica vazia.
      }

      return { label: room.label, familyOk: false };
    })
  );

  const saved = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const savedLabels = saved.map((item) => item.label);
  const familyLabels = saved.filter((item) => item.familyOk).map((item) => item.label);
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

  notifyLessonThemeWrite(input.eventId);
  return { savedLabels, failedLabels, familyLabels };
}
