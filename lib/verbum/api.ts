import { supabase } from '@/lib/supabase';
import type {
  FillBlankPayload,
  OrderWordsPayload,
  VerbumAnswerResult,
  VerbumBook,
  VerbumBookLesson,
  VerbumCourseHome,
  VerbumExercise,
  VerbumExerciseType,
  VerbumLearner,
  VerbumLessonRef,
  VerbumLessonStatus,
  VerbumPathNode,
  VerbumSection,
  MatchPairsPayload,
  MatchPair,
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
  const id = Number(row?.id);
  if (!row || !Number.isFinite(id) || id <= 0) {
    return null;
  }
  return {
    id,
    title: String(row.title ?? ''),
    unitTitle: String(row.unit_title ?? ''),
    theologicalSummary: String(row.theological_summary ?? ''),
  };
}

function readStatus(value: unknown): VerbumLessonStatus {
  if (value === 'done' || value === 'current' || value === 'locked') {
    return value;
  }
  return 'current';
}

function readBookLessons(value: unknown): VerbumBookLesson[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const lesson = asRecord(item);
    const id = Number(lesson?.id);
    if (!lesson || !Number.isFinite(id) || id <= 0) {
      return [];
    }
    return [
      {
        id,
        title: String(lesson.title ?? ''),
        orderIndex: Number(lesson.order_index ?? 0),
        completed: lesson.completed === true || lesson.status === 'done',
        status: readStatus(lesson.status),
      },
    ];
  });
}

function readPath(value: unknown): VerbumPathNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const node = asRecord(item);
    const id = Number(node?.id);
    if (!node || !Number.isFinite(id) || id <= 0) {
      return [];
    }
    return [
      {
        id,
        title: String(node.title ?? ''),
        seq: Number(node.seq ?? 0),
        status: readStatus(node.status),
        unitTitle: String(node.unit_title ?? ''),
        sectionTitle: String(node.section_title ?? ''),
        cefr: String(node.cefr ?? ''),
        bookName: String(node.book_name ?? ''),
        boss: node.boss === true,
        nodeType: String(node.node_type ?? 'LESSON'),
        totalLevels: Number(node.total_levels ?? 1),
        completedLevels: Number(node.completed_levels ?? 0),
        nextLessonId: Number(node.next_lesson_id) > 0 ? Number(node.next_lesson_id) : null,
        xpReward: Number(node.xp_reward ?? 15),
        unitOrder: Number(node.unit_order ?? 0),
      },
    ];
  });
}

function readSection(value: unknown): VerbumSection | null {
  const row = asRecord(value);
  if (!row || typeof row.title !== 'string') {
    return null;
  }
  return {
    title: row.title,
    cefr: String(row.cefr ?? ''),
    book: String(row.book ?? ''),
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
        lessons: readBookLessons(book.lessons),
      },
    ];
  });

  return {
    learner: readLearner(row?.learner),
    books,
    lesson: readLesson(row?.lesson),
    memorialsDue: Number(row?.memorials_due ?? 0),
    path: readPath(row?.path),
    section: readSection(row?.section),
  };
}

function readPairs(value: unknown): MatchPair[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const pair = asRecord(item);
    if (!pair) {
      return [];
    }
    return [{ en: String(pair.en ?? ''), pt: String(pair.pt ?? '') }];
  });
}

function readOrderPayload(row: Record<string, unknown>): OrderWordsPayload {
  const shuffled = Array.isArray(row.shuffled) ? row.shuffled.map(String) : [];
  const answer = Array.isArray(row.answer) ? row.answer.map(String) : [];
  return {
    shuffled,
    answer,
    lemma: typeof row.lemma === 'string' ? row.lemma : undefined,
  };
}

function readPayload(
  type: VerbumExerciseType,
  value: unknown
): FillBlankPayload | OrderWordsPayload | MatchPairsPayload {
  const row = asRecord(value) ?? {};
  if (type === 'MATCH_PAIRS') {
    return {
      pairs: readPairs(row.pairs),
      lemma: typeof row.lemma === 'string' ? row.lemma : undefined,
    };
  }
  if (type === 'ORDER_WORDS' || type === 'LISTENING_DICTATION') {
    return readOrderPayload(row);
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
    if (
      !exercise
      || (type !== 'FILL_BLANK' && type !== 'ORDER_WORDS' && type !== 'MATCH_PAIRS' && type !== 'LISTENING_DICTATION')
      || typeof exercise.id !== 'number'
    ) {
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
  answer: { choice?: string; order?: string[]; matches?: MatchPair[] }
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

export async function finishVerbumLesson(lessonId: number): Promise<{
  lesson: VerbumLessonRef | null;
  unitCrown: boolean;
  talentsAwarded: number;
  unitTitle: string;
}> {
  const { data, error } = await supabase.rpc('verbum_finish_lesson', { p_lesson_id: lessonId });
  if (error) {
    throw new Error(error.message);
  }
  const row = asRecord(data);
  return {
    lesson: readLesson(row?.lesson),
    unitCrown: row?.unit_crown === true,
    talentsAwarded: Number(row?.talents_awarded ?? 0),
    unitTitle: String(row?.unit_title ?? ''),
  };
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
