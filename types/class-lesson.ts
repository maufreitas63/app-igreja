export type ClassRoomKey = 'KIDS' | 'TEENS';

export type RoomType = 'infantil' | 'jovens';

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
  servers: LessonServerInfo[];
}

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
