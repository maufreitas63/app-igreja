import type { LessonCategory } from '@/types/class-lesson';

export type { LessonCategory };

export interface CuratedLessonTheme {
  id: string;
  category: LessonCategory;
  title: string;
  bible_passage: string;
  core_lesson: string;
  activity_suggestion: string;
  created_at?: string;
}
