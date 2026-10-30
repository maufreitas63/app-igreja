import { supabase } from '@/lib/supabase';
import type {
  FillBlankPayload,
  OrderWordsPayload,
  VerbumAnswerResult,
  VerbumBook,
  VerbumCourseHome,
  VerbumExercise,
  VerbumExerciseType,
  VerbumLearner,
  VerbumLessonRef,
} from '@/lib/verbum/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readLearner(value: unknown): VerbumLearner {
  const row = asRecord(value);
  return {
    talents: Number(row?.talents ?? 0),
    shields: Number(row?.shields ?? 0),
    infiniteShields: row?.infinite_shields === true,
    streak: Number(row?.streak ?? 0),
    tier: typeof row?.tier === 'string' ? row.tier : 'FREE',
  };
}

function readLesson(value: unknown): VerbumLessonRef | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== 'number') {
    return null;
  }
  return {
    id: row.id,
    title: String(row.title ?? ''),
    unitTitle: String(row.unit_title ?? ''),
    theologicalSummary: String(row.theological_summary ?? ''),
  };
}

export async function loadVerbumCourse(): Promise<VerbumCourseHome> {
  const { data, error } = await supabase.rpc('verbum_course_home');
  if (error) {
    throw new Error(error.message);
  }
  const row = asRecord(data);
  const booksRaw = Array.isArray(row?.books) ? row.books : [];
  const books: VerbumBook[] = booksRaw.flatMap((item) => {
    const book = asRecord(item);
    if (!book) {
      return [];
    }
    return [
      {
        orderIndex: Number(book.order_index ?? 0),
        nameEn: String(book.name_en ?? ''),
        namePt: String(book.name_pt ?? ''),
        abbreviationEn: String(book.abbreviation_en ?? ''),
        cefr: String(book.cefr ?? ''),
        division: String(book.division ?? ''),
      },
    ];
  });

  return {
    learner: readLearner(row?.learner),
    books,
    lesson: readLesson(row?.lesson),
    memorialsDue: Number(row?.memorials_due ?? 0),
  };
}

function readPayload(type: VerbumExerciseType, value: unknown): FillBlankPayload | OrderWordsPayload {
  const row = asRecord(value) ?? {};
  if (type === 'ORDER_WORDS') {
    const shuffled = Array.isArray(row.shuffled) ? row.shuffled.map(String) : [];
    const answer = Array.isArray(row.answer) ? row.answer.map(String) : [];
    return {
      shuffled,
      answer,
      lemma: typeof row.lemma === 'string' ? row.lemma : undefined,
    };
  }
  const options = Array.isArray(row.options) ? row.options.map(String) : [];
  return {
    sentence: String(row.sentence ?? ''),
    options,
    answer: String(row.answer ?? ''),
    lemma: typeof row.lemma === 'string' ? row.lemma : undefined,
  };
}

export async function loadVerbumLesson(lessonId: number): Promise<{
  lesson: VerbumLessonRef;
  learner: VerbumLearner;
  exercises: VerbumExercise[];
}> {
  const { data, error } = await supabase.rpc('verbum_lesson_session', { p_lesson_id: lessonId });
  if (error) {
    throw new Error(error.message);
  }
  const row = asRecord(data);
  const lesson = readLesson(row?.lesson);
  if (!lesson) {
    throw new Error('Lição do Verbum não encontrada.');
  }
  const raw = Array.isArray(row?.exercises) ? row.exercises : [];
  const exercises: VerbumExercise[] = raw.flatMap((item) => {
    const exercise = asRecord(item);
    const type = exercise?.exercise_type;
    if (!exercise || (type !== 'FILL_BLANK' && type !== 'ORDER_WORDS') || typeof exercise.id !== 'number') {
      return [];
    }
    return [
      {
        id: exercise.id,
        exerciseType: type,
        prompt: String(exercise.prompt ?? ''),
        passageRef: typeof exercise.bible_passage_ref === 'string' ? exercise.bible_passage_ref : null,
        verseEn: String(exercise.verse_target_en ?? ''),
        versePt: String(exercise.verse_target_pt ?? ''),
        audioUrl: typeof exercise.audio_url === 'string' ? exercise.audio_url : null,
        payload: readPayload(type, exercise.payload),
      },
    ];
  });
  return { lesson, learner: readLearner(row?.learner), exercises };
}

export async function submitVerbumExercise(
  exerciseId: number,
  answer: { choice?: string; order?: string[] }
): Promise<VerbumAnswerResult> {
  const { data, error } = await supabase.rpc('verbum_submit_exercise', {
    p_exercise_id: exerciseId,
    p_answer: answer,
  });
  if (error) {
    throw new Error(error.message);
  }
  const row = asRecord(data);
  return {
    correct: row?.correct === true,
    shields: Number(row?.shields ?? 0),
    infiniteShields: row?.infinite_shields === true,
    paused: row?.paused === true,
    talents: Number(row?.talents ?? 0),
    streak: Number(row?.streak ?? 0),
    expectedLabel: String(row?.expected_label ?? ''),
    message: String(row?.message ?? ''),
  };
}

export async function finishVerbumLesson(lessonId: number): Promise<VerbumLessonRef | null> {
  const { data, error } = await supabase.rpc('verbum_finish_lesson', { p_lesson_id: lessonId });
  if (error) {
    throw new Error(error.message);
  }
  return readLesson(asRecord(data)?.lesson);
}

export async function restoreVerbumShield(): Promise<VerbumLearner> {
  const { data, error } = await supabase.rpc('verbum_restore_shield');
  if (error) {
    throw new Error(error.message);
  }
  return readLearner(data);
}

export function speakVerse(text: string, audioUrl: string | null): void {
  if (audioUrl && typeof Audio !== 'undefined') {
    const player = new Audio(audioUrl);
    void player.play();
    return;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}
