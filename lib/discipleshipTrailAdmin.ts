/**
 * Admin da Trilha — editar temas (módulos/lições) da igreja da sessão.
 * SQL: scripts/discipleship-trail-themes-admin.sql
 */

import { DISCIPLESHIP_TRAIL_SQL_HINT } from '@/lib/discipleshipTrail';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const DISCIPLESHIP_THEMES_SQL_HINT =
  'Execute no Supabase: scripts/discipleship-trail-themes-admin.sql (após discipleship-trail-schema.sql).';

export type DiscipleshipAdminLesson = {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  reflection_question: string | null;
  sort_order: number;
  is_active: boolean;
  is_seed: boolean;
};

export type DiscipleshipAdminModule = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  is_seed: boolean;
  lessons: DiscipleshipAdminLesson[];
};

const mapLesson = (raw: Record<string, unknown>): DiscipleshipAdminLesson | null => {
  const id = String(raw.id ?? '').trim();
  const moduleId = String(raw.module_id ?? '').trim();
  const title = String(raw.title ?? '').trim();
  if (!id || !moduleId || !title) return null;

  return {
    id,
    module_id: moduleId,
    title,
    content: raw.content != null ? String(raw.content) : null,
    video_url: raw.video_url != null ? String(raw.video_url) : null,
    reflection_question:
      raw.reflection_question != null ? String(raw.reflection_question) : null,
    sort_order: Number(raw.sort_order ?? 0),
    is_active: Boolean(raw.is_active),
    is_seed: Boolean(raw.is_seed),
  };
};

export async function fetchDiscipleshipTrailAdmin(): Promise<DiscipleshipAdminModule[]> {
  const { data, error } = await supabase.rpc('list_discipleship_trail_admin');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_discipleship_trail_admin')) {
      throw new Error(DISCIPLESHIP_THEMES_SQL_HINT);
    }
    throw error;
  }

  const payload = data as { success?: boolean; message?: string; modules?: unknown } | null;
  if (!payload?.success) {
    throw new Error(payload?.message || DISCIPLESHIP_THEMES_SQL_HINT);
  }

  const modules = Array.isArray(payload.modules) ? payload.modules : [];

  return modules
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      const title = String(row.title ?? '').trim();
      if (!id || !title) return null;

      const lessonsRaw = Array.isArray(row.lessons) ? row.lessons : [];
      return {
        id,
        title,
        description: row.description != null ? String(row.description) : null,
        sort_order: Number(row.sort_order ?? 0),
        is_active: Boolean(row.is_active),
        is_seed: Boolean(row.is_seed),
        lessons: lessonsRaw
          .map((lesson) => mapLesson(lesson as Record<string, unknown>))
          .filter((lesson): lesson is DiscipleshipAdminLesson => lesson !== null),
      } satisfies DiscipleshipAdminModule;
    })
    .filter((module): module is DiscipleshipAdminModule => module !== null);
}

export async function saveDiscipleshipModuleAdmin(input: {
  id?: string | null;
  title: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_discipleship_module_admin', {
    p_id: input.id ?? null,
    p_title: input.title,
    p_description: input.description ?? null,
    p_sort_order: input.sort_order ?? null,
    p_is_active: input.is_active ?? null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'upsert_discipleship_module_admin')) {
      throw new Error(DISCIPLESHIP_THEMES_SQL_HINT);
    }
    throw error;
  }

  const payload = data as { success?: boolean; message?: string; id?: string } | null;
  if (!payload?.success || !payload.id) {
    throw new Error(payload?.message || 'Não foi possível salvar o módulo.');
  }

  return String(payload.id);
}

export async function saveDiscipleshipLessonAdmin(input: {
  id?: string | null;
  module_id?: string | null;
  title: string;
  content?: string | null;
  video_url?: string | null;
  reflection_question?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_discipleship_lesson_admin', {
    p_id: input.id ?? null,
    p_module_id: input.module_id ?? null,
    p_title: input.title,
    p_content: input.content ?? null,
    p_video_url: input.video_url ?? null,
    p_reflection_question: input.reflection_question ?? null,
    p_sort_order: input.sort_order ?? null,
    p_is_active: input.is_active ?? null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'upsert_discipleship_lesson_admin')) {
      throw new Error(DISCIPLESHIP_THEMES_SQL_HINT);
    }
    throw error;
  }

  const payload = data as { success?: boolean; message?: string; id?: string } | null;
  if (!payload?.success || !payload.id) {
    throw new Error(payload?.message || 'Não foi possível salvar a lição.');
  }

  return String(payload.id);
}

export { DISCIPLESHIP_TRAIL_SQL_HINT };
