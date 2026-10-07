import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import type {
  ClassLesson,
  ClassLessonDetail,
  ClassLessonInput,
  ClassRoomKey,
  LessonServerInfo,
  RoomType,
} from '@/types/class-lesson';

const SQL_HINT = 'O planejamento de aula ainda não está disponível neste ambiente.';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const parseLesson = (value: unknown): ClassLesson | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();
  const roomKey = String(row.room_key ?? '').trim();
  const classDate = String(row.class_date ?? '').trim().slice(0, 10);

  if (!id || (roomKey !== 'KIDS' && roomKey !== 'TEENS') || !classDate) {
    return null;
  }

  return {
    id,
    room_key: roomKey,
    event_id: String(row.event_id ?? ''),
    teacher_id: String(row.teacher_id ?? ''),
    class_date: classDate,
    title: String(row.title ?? ''),
    bible_passage: String(row.bible_passage ?? ''),
    main_objective: String(row.main_objective ?? ''),
    resources_notes: String(row.resources_notes ?? ''),
    family_extension: String(row.family_extension ?? ''),
  };
};

async function rpcPayload(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    if (isSupabaseRpcMissingError(error, fn)) {
      throw new Error(SQL_HINT);
    }
    throw error;
  }

  return asRecord(data);
}

const toRoomType = (roomKey: string): RoomType => (roomKey === 'TEENS' ? 'jovens' : 'infantil');

const parseServer = (value: unknown): LessonServerInfo | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();
  if (!id) {
    return null;
  }

  const selfie = String(row.selfie_url ?? '').trim();

  return {
    id,
    fullName: String(row.full_name ?? '').trim() || 'Servidor',
    selfieUrl: selfie || null,
  };
};

const parseLessonDetail = (value: unknown): ClassLessonDetail | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();
  const classDate = String(row.class_date ?? '').trim().slice(0, 10);
  const title = String(row.title ?? '').trim();

  if (!id || !classDate || !title) {
    return null;
  }

  const servers = Array.isArray(row.servers)
    ? row.servers.map(parseServer).filter((server): server is LessonServerInfo => server !== null)
    : [];

  return {
    id,
    roomType: toRoomType(String(row.room_key ?? '')),
    classDate,
    title,
    biblePassage: String(row.bible_passage ?? ''),
    mainObjective: String(row.main_objective ?? ''),
    resourcesNotes: String(row.resources_notes ?? '').trim() || null,
    familyExtension: String(row.family_extension ?? '').trim() || null,
    servers,
  };
};

export async function listClassLessonTrail(roomKey: ClassRoomKey): Promise<ClassLessonDetail[]> {
  const payload = await rpcPayload('list_class_lesson_trail', { p_room_key: roomKey });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar a trilha de ensino.'));
  }

  const rows = Array.isArray(payload.lessons) ? payload.lessons : [];
  return rows
    .map(parseLessonDetail)
    .filter((lesson): lesson is ClassLessonDetail => lesson !== null);
}

export async function fetchClassLesson(eventId: string, roomKey: ClassRoomKey): Promise<ClassLesson | null> {
  const payload = await rpcPayload('get_class_lesson', {
    p_event_id: eventId,
    p_room_key: roomKey,
  });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar o planejamento.'));
  }

  return parseLesson(payload.lesson);
}

export async function saveClassLesson(
  eventId: string,
  roomKey: ClassRoomKey,
  input: ClassLessonInput
): Promise<ClassLesson> {
  const payload = await rpcPayload('save_class_lesson', {
    p_event_id: eventId,
    p_room_key: roomKey,
    p_title: input.title.trim(),
    p_bible_passage: input.bible_passage.trim(),
    p_main_objective: input.main_objective.trim(),
    p_resources_notes: input.resources_notes?.trim() ?? '',
    p_family_extension: input.family_extension?.trim() ?? '',
  });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível gravar o planejamento.'));
  }

  const lesson = parseLesson(payload.lesson);

  if (!lesson) {
    throw new Error('O planejamento foi gravado, mas não pôde ser lido.');
  }

  return lesson;
}
