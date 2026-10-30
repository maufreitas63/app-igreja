export type VerbumExerciseType = 'FILL_BLANK' | 'ORDER_WORDS';

export type VerbumBook = {
  orderIndex: number;
  nameEn: string;
  namePt: string;
  abbreviationEn: string;
  cefr: string;
  division: string;
};

export type VerbumLearner = {
  talents: number;
  shields: number;
  infiniteShields: boolean;
  streak: number;
  tier: string;
};

export type VerbumLessonRef = {
  id: number;
  title: string;
  unitTitle: string;
  theologicalSummary: string;
};

export type VerbumCourseHome = {
  learner: VerbumLearner;
  books: VerbumBook[];
  lesson: VerbumLessonRef | null;
  memorialsDue: number;
};

export type FillBlankPayload = {
  sentence: string;
  options: string[];
  answer: string;
  lemma?: string;
};

export type OrderWordsPayload = {
  shuffled: string[];
  answer: string[];
  lemma?: string;
};

export type VerbumExercise = {
  id: number;
  exerciseType: VerbumExerciseType;
  prompt: string;
  passageRef: string | null;
  verseEn: string;
  versePt: string;
  audioUrl: string | null;
  payload: FillBlankPayload | OrderWordsPayload;
};

export type VerbumAnswerResult = {
  correct: boolean;
  shields: number;
  infiniteShields: boolean;
  paused: boolean;
  talents: number;
  streak: number;
  expectedLabel: string;
  message: string;
};
