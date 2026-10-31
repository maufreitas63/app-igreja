export type VerbumExerciseType = 'FILL_BLANK' | 'ORDER_WORDS' | 'MATCH_PAIRS' | 'LISTENING_DICTATION' | 'SPEAKING_VERSE';

export type VerbumLessonStatus = 'done' | 'current' | 'locked';

export type VerbumBookLesson = {
  id: number;
  title: string;
  orderIndex: number;
  completed: boolean;
  status: VerbumLessonStatus;
};

export type VerbumPathNode = {
  id: number;
  title: string;
  seq: number;
  status: VerbumLessonStatus;
  unitTitle: string;
  sectionTitle: string;
  cefr: string;
  bookName: string;
  boss: boolean;
  nodeType: string;
  totalLevels: number;
  completedLevels: number;
  nextLessonId: number | null;
  xpReward: number;
  unitOrder: number;
};

export type VerbumSection = {
  title: string;
  cefr: string;
  book: string;
};

export type VerbumBook = {
  orderIndex: number;
  nameEn: string;
  namePt: string;
  abbreviationEn: string;
  cefr: string;
  division: string;
  lessons: VerbumBookLesson[];
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
  path: VerbumPathNode[];
  section: VerbumSection | null;
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

export type MatchPair = {
  en: string;
  pt: string;
};

export type MatchPairsPayload = {
  pairs: MatchPair[];
  lemma?: string;
};

export type SpeakingVersePayload = {
  targetPhrase: string;
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
  payload: FillBlankPayload | OrderWordsPayload | MatchPairsPayload | SpeakingVersePayload;
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

export type VerbConjugation = {
  person: string;
  pronounEn: string;
  formEn: string;
  pronounPt: string;
  formPt: string;
};

export type LessonVerb = {
  id: number;
  infinitiveEn: string;
  infinitivePt: string;
  tenseEn: string;
  tensePt: string;
  verbType: string;
  verseEn: string;
  versePt: string;
  conjugations: VerbConjugation[];
};
