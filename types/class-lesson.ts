export type ClassRoomKey = 'KIDS' | 'TEENS';

export interface ClassLessonInput {
  title: string;
  bible_passage: string;
  main_objective: string;
  resources_notes?: string;
  family_extension?: string;
  class_date: string;
}

export interface ClassLesson extends ClassLessonInput {
  id: string;
  room_key: ClassRoomKey;
  event_id: string;
  teacher_id: string;
}
