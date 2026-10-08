export type ClassRoomKey = 'KIDS' | 'TEENS';

export type RoomType = 'infantil' | 'jovens';

export type LessonCategory = 'identidade' | 'carater' | 'historias' | 'proximo';

export interface LessonCategoryInfo {
  code: LessonCategory;
  title: string;
  description: string;
}

export const LESSON_CATEGORIES: LessonCategoryInfo[] = [
  {
    code: 'identidade',
    title: 'Identidade e Valor em Deus',
    description:
      'O que a criança aprende sobre quem ela é à luz da Palavra, construindo uma autoestima saudável baseada no amor incondicional de Deus.',
  },
  {
    code: 'carater',
    title: 'Caráter e Prática Cristã',
    description:
      'O desenvolvimento prático de virtudes e atitudes no dia a dia, transformando o comportamento nas pequenas escolhas da rotina.',
  },
  {
    code: 'historias',
    title: 'Histórias da Bíblia e Grandes Personagens',
    description:
      'Mergulho nas narrativas clássicas das Escrituras, extraindo lições práticas da fé dos personagens.',
  },
  {
    code: 'proximo',
    title: 'Amor ao Próximo e Missões',
    description:
      'O olhar voltado para fora, ensinando empatia, generosidade, serviço voluntário e cuidado com o próximo.',
  },
];

const LESSON_CATEGORY_CODES = new Set<string>(LESSON_CATEGORIES.map((item) => item.code));

export function parseLessonCategory(value: unknown): LessonCategory | null {
  const code = String(value ?? '').trim().toLowerCase();
  return LESSON_CATEGORY_CODES.has(code) ? (code as LessonCategory) : null;
}

export function lessonCategoryInfo(value: unknown): LessonCategoryInfo | null {
  const code = parseLessonCategory(value);
  return code ? LESSON_CATEGORIES.find((item) => item.code === code) ?? null : null;
}

export interface LessonServerInfo {
  id: string;
  fullName: string;
  selfieUrl?: string | null;
}

export interface ClassLessonDetail {
  id: string;
  roomType: RoomType;
  classDate: string;
  title: string;
  biblePassage: string;
  mainObjective: string;
  resourcesNotes?: string | null;
  familyExtension?: string | null;
  category: LessonCategory | null;
  servers: LessonServerInfo[];
}

export interface ClassLessonInput {
  title: string;
  bible_passage: string;
  main_objective: string;
  resources_notes?: string;
  family_extension?: string;
  class_date: string;
  category: LessonCategory;
}

export interface ClassLesson extends Omit<ClassLessonInput, 'category'> {
  id: string;
  room_key: ClassRoomKey;
  event_id: string;
  teacher_id: string;
  category: LessonCategory | null;
}
