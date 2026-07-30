/**
 * Trilha de Discipulado — consultas Supabase (multi-tenant).
 *
 * Isolamento: `tenant_id` (= church_id / public.igrejas.id) via headers de sessão
 * (`x-tenant-id`, `x-session-token`) injetados por `supabaseSessionFetch`.
 * O RLS filtra automaticamente; não é obrigatório `.eq('tenant_id', …)` no client,
 * mas pode ser usado como defesa em profundidade quando o tenant ativo é conhecido.
 *
 * SQL: scripts/discipleship-trail-schema.sql
 */

import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';

export type DiscipleshipProgressStatus = 'not_started' | 'in_progress' | 'completed';

export type DiscipleshipModule = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  is_seed: boolean;
};

export type DiscipleshipLesson = {
  id: string;
  tenant_id: string;
  module_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  reflection_question: string | null;
  sort_order: number;
  is_active: boolean;
  is_seed: boolean;
};

export type UserDiscipleshipProgress = {
  id: string;
  tenant_id: string;
  profile_id: string;
  lesson_id: string;
  status: DiscipleshipProgressStatus;
  reflection_answer: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type DiscipleshipLessonWithProgress = DiscipleshipLesson & {
  progress: UserDiscipleshipProgress | null;
};

export type DiscipleshipModuleWithLessons = DiscipleshipModule & {
  lessons: DiscipleshipLessonWithProgress[];
};

const MODULE_COLUMNS =
  'id, tenant_id, title, description, sort_order, is_active, is_seed';
const LESSON_COLUMNS =
  'id, tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed';
const PROGRESS_COLUMNS =
  'id, tenant_id, profile_id, lesson_id, status, reflection_answer, started_at, completed_at';

/**
 * Busca módulos ativos da igreja da sessão, com lições aninhadas (ordenados).
 * O RLS garante que só retornam linhas do tenant ativo.
 */
export async function fetchDiscipleshipModulesWithLessons(): Promise<DiscipleshipModuleWithLessons[]> {
  const { data, error } = await supabase
    .from('discipleship_modules')
    .select(
      `
      ${MODULE_COLUMNS},
      lessons:discipleship_lessons (
        ${LESSON_COLUMNS}
      )
    `
    )
    .eq('is_active', true)
    .eq('lessons.is_active', true)
    .order('sort_order', { ascending: true })
    .order('sort_order', { ascending: true, referencedTable: 'discipleship_lessons' });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const lessons = Array.isArray(row.lessons) ? row.lessons : [];
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      title: String(row.title),
      description: row.description == null ? null : String(row.description),
      sort_order: Number(row.sort_order ?? 0),
      is_active: Boolean(row.is_active),
      is_seed: Boolean(row.is_seed),
      lessons: lessons
        .map((lesson) => ({
          id: String(lesson.id),
          tenant_id: String(lesson.tenant_id),
          module_id: String(lesson.module_id),
          title: String(lesson.title),
          content: lesson.content == null ? null : String(lesson.content),
          video_url: lesson.video_url == null ? null : String(lesson.video_url),
          reflection_question:
            lesson.reflection_question == null ? null : String(lesson.reflection_question),
          sort_order: Number(lesson.sort_order ?? 0),
          is_active: Boolean(lesson.is_active),
          is_seed: Boolean(lesson.is_seed),
          progress: null as UserDiscipleshipProgress | null,
        }))
        .sort((a, b) => a.sort_order - b.sort_order),
    };
  });
}

/**
 * Progresso do usuário efetivo (respeita Modo Ghost) na igreja da sessão.
 */
export async function fetchMyDiscipleshipProgress(
  profileId?: string
): Promise<UserDiscipleshipProgress[]> {
  const effectiveProfileId = profileId ?? (await resolveEffectiveProfileId());
  if (!effectiveProfileId) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_discipleship_progress')
    .select(PROGRESS_COLUMNS)
    .eq('profile_id', effectiveProfileId);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProgressRow);
}

/**
 * Trilha completa: módulos + lições + status de progresso do usuário logado.
 */
export async function fetchDiscipleshipTrailForCurrentUser(): Promise<DiscipleshipModuleWithLessons[]> {
  const [modules, progressRows] = await Promise.all([
    fetchDiscipleshipModulesWithLessons(),
    fetchMyDiscipleshipProgress(),
  ]);

  const progressByLesson = new Map(progressRows.map((row) => [row.lesson_id, row]));

  return modules.map((module) => ({
    ...module,
    lessons: module.lessons.map((lesson) => ({
      ...lesson,
      progress: progressByLesson.get(lesson.id) ?? null,
    })),
  }));
}

/**
 * Cria ou atualiza o progresso de uma lição do usuário efetivo.
 */
export async function upsertMyLessonProgress(input: {
  lessonId: string;
  tenantId: string;
  status: DiscipleshipProgressStatus;
  reflectionAnswer?: string | null;
  profileId?: string;
}): Promise<UserDiscipleshipProgress> {
  const effectiveProfileId = input.profileId ?? (await resolveEffectiveProfileId());
  if (!effectiveProfileId) {
    throw new Error('Sessão inválida: perfil não identificado.');
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    profile_id: effectiveProfileId,
    lesson_id: input.lessonId,
    status: input.status,
    reflection_answer: input.reflectionAnswer ?? null,
    completed_at: input.status === 'completed' ? now : null,
  };

  if (input.status !== 'not_started') {
    payload.started_at = now;
  } else {
    payload.started_at = null;
  }

  const { data, error } = await supabase
    .from('user_discipleship_progress')
    .upsert(payload, {
      onConflict: 'tenant_id,profile_id,lesson_id',
    })
    .select(PROGRESS_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapProgressRow(data);
}

function mapProgressRow(row: {
  id: string;
  tenant_id: string;
  profile_id: string;
  lesson_id: string;
  status: string;
  reflection_answer: string | null;
  started_at: string | null;
  completed_at: string | null;
}): UserDiscipleshipProgress {
  const status = (['not_started', 'in_progress', 'completed'].includes(row.status)
    ? row.status
    : 'not_started') as DiscipleshipProgressStatus;

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    profile_id: String(row.profile_id),
    lesson_id: String(row.lesson_id),
    status,
    reflection_answer: row.reflection_answer == null ? null : String(row.reflection_answer),
    started_at: row.started_at == null ? null : String(row.started_at),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
  };
}

/* =============================================================================
 * Exemplos de uso (comentados) — queries diretas no cliente Supabase
 * =============================================================================
 *
 * // 1) Módulos + lições da igreja da sessão
 * const { data: modules } = await supabase
 *   .from('discipleship_modules')
 *   .select(`
 *     id, title, description, sort_order,
 *     lessons:discipleship_lessons (
 *       id, title, content, video_url, reflection_question, sort_order
 *     )
 *   `)
 *   .eq('is_active', true)
 *   .order('sort_order', { ascending: true });
 *
 * // 2) Progresso do usuário logado (use resolveEffectiveProfileId / Ghost)
 * const profileId = await resolveEffectiveProfileId();
 * const { data: progress } = await supabase
 *   .from('user_discipleship_progress')
 *   .select('lesson_id, status, reflection_answer, completed_at')
 *   .eq('profile_id', profileId);
 *
 * // 3) Marcar lição como concluída
 * await supabase.from('user_discipleship_progress').upsert({
 *   tenant_id: activeTenantId,
 *   profile_id: profileId,
 *   lesson_id: lessonId,
 *   status: 'completed',
 *   completed_at: new Date().toISOString(),
 * }, { onConflict: 'tenant_id,profile_id,lesson_id' });
 *
 * // Preferência no app: fetchDiscipleshipTrailForCurrentUser()
 * ========================================================================== */
