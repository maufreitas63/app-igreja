/**
 * Trilha de Discipulado — progresso, estados visuais, selos e alertas pastorais.
 *
 * SQL:
 *   scripts/discipleship-trail-schema.sql
 *   scripts/discipleship-trail-badges-alerts.sql
 *   scripts/discipleship-trail-badge-colors.sql
 */

import {
  discipleshipBadgeColorForStep,
  DISCIPLESHIP_LOCKED_BADGE_COLOR,
  DISCIPLESHIP_STEP_BADGE_META,
  DISCIPLESHIP_TRAIL_GOLD_COLOR,
} from '@/lib/discipleshipBadgeColors';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { getStoredTenantId } from '@/lib/tenantSession';

export const DISCIPLESHIP_TRAIL_SQL_HINT =
  'Execute no Supabase: scripts/discipleship-trail-schema.sql, scripts/discipleship-trail-badges-alerts.sql, scripts/discipleship-trail-progress-gates.sql e scripts/discipleship-trail-badge-colors.sql';

export type DiscipleshipProgressStatus = 'not_started' | 'in_progress' | 'completed';

/** Estado visual sequencial da trilha. */
export type DiscipleshipVisualState = 'locked' | 'available' | 'in_progress' | 'completed';

export type DiscipleshipBadgeCode = 'module_complete' | 'trail_complete';

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

export type UserDiscipleshipBadge = {
  id: string;
  tenant_id: string;
  profile_id: string;
  module_id: string | null;
  badge_code: DiscipleshipBadgeCode;
  badge_title: string;
  badge_description: string | null;
  badge_color: string | null;
  step_order: number | null;
  earned_at: string;
};

export type DiscipleshipPastoralAlert = {
  id: string;
  tenant_id: string;
  profile_id: string;
  alert_type: string;
  title: string;
  message: string;
  status: 'new' | 'acknowledged' | 'closed';
  acknowledged_at: string | null;
  created_at: string;
  module_id?: string | null;
  profile_full_name?: string | null;
};

export type DiscipleshipLessonWithProgress = DiscipleshipLesson & {
  progress: UserDiscipleshipProgress | null;
  visualState: DiscipleshipVisualState;
};

export type DiscipleshipModuleWithLessons = DiscipleshipModule & {
  lessons: DiscipleshipLessonWithProgress[];
  visualState: DiscipleshipVisualState;
  percentComplete: number;
  completedLessons: number;
  totalLessons: number;
  badge: UserDiscipleshipBadge | null;
};

export type DiscipleshipTrailSnapshot = {
  modules: DiscipleshipModuleWithLessons[];
  badges: UserDiscipleshipBadge[];
  percentComplete: number;
  completedLessons: number;
  totalLessons: number;
  trailComplete: boolean;
  trailBadge: UserDiscipleshipBadge | null;
};

export type DiscipleshipAchievementEvent = {
  moduleBadge: UserDiscipleshipBadge | null;
  trailBadge: UserDiscipleshipBadge | null;
  moduleJustCompleted: boolean;
  trailJustCompleted: boolean;
};

const MODULE_COLUMNS =
  'id, tenant_id, title, description, sort_order, is_active, is_seed';
const LESSON_COLUMNS =
  'id, tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed';
const PROGRESS_COLUMNS =
  'id, tenant_id, profile_id, lesson_id, status, reflection_answer, started_at, completed_at';
const BADGE_COLUMNS =
  'id, tenant_id, profile_id, module_id, badge_code, badge_title, badge_description, badge_color, step_order, earned_at';
const ALERT_COLUMNS =
  'id, tenant_id, profile_id, module_id, alert_type, title, message, status, acknowledged_at, created_at';

export function lessonProgressStatus(
  lesson: Pick<DiscipleshipLessonWithProgress, 'progress'>
): DiscipleshipProgressStatus {
  return lesson.progress?.status ?? 'not_started';
}

export function computePercent(done: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((done / total) * 100);
}

export function countCompletedLessons(
  modules: Array<{ lessons: Array<{ progress: UserDiscipleshipProgress | null }> }>
): { completed: number; total: number; percent: number } {
  let completed = 0;
  let total = 0;

  for (const module of modules) {
    for (const lesson of module.lessons) {
      total += 1;
      if (lesson.progress?.status === 'completed') {
        completed += 1;
      }
    }
  }

  return { completed, total, percent: computePercent(completed, total) };
}

/**
 * Aplica estados visuais sequenciais: lição/módulo bloqueados até o anterior concluir.
 */
export function enrichTrailWithVisualState(
  modules: Array<DiscipleshipModule & { lessons: DiscipleshipLessonWithProgress[] }>,
  badges: UserDiscipleshipBadge[] = []
): DiscipleshipModuleWithLessons[] {
  const badgeByModule = new Map(
    badges
      .filter((b) => b.badge_code === 'module_complete' && b.module_id)
      .map((b) => [b.module_id as string, b])
  );

  const sortedModules = [...modules].sort((a, b) => a.sort_order - b.sort_order);
  let previousModuleComplete = true;

  return sortedModules.map((module) => {
    const lessons = [...module.lessons].sort((a, b) => a.sort_order - b.sort_order);
    const moduleUnlocked = previousModuleComplete;
    let previousLessonComplete = true;

    const lessonsWithState: DiscipleshipLessonWithProgress[] = lessons.map((lesson) => {
      const status = lesson.progress?.status ?? 'not_started';
      let visualState: DiscipleshipVisualState;

      if (!moduleUnlocked || !previousLessonComplete) {
        visualState = 'locked';
      } else if (status === 'completed') {
        visualState = 'completed';
      } else if (status === 'in_progress') {
        visualState = 'in_progress';
      } else {
        visualState = 'available';
      }

      previousLessonComplete = status === 'completed';

      return { ...lesson, visualState };
    });

    const completedLessons = lessonsWithState.filter(
      (l) => l.progress?.status === 'completed'
    ).length;
    const totalLessons = lessonsWithState.length;
    const percentComplete = computePercent(completedLessons, totalLessons);

    let visualState: DiscipleshipVisualState;
    if (!moduleUnlocked) {
      visualState = 'locked';
    } else if (totalLessons > 0 && completedLessons === totalLessons) {
      visualState = 'completed';
    } else if (completedLessons > 0 || lessonsWithState.some((l) => l.visualState === 'in_progress')) {
      visualState = 'in_progress';
    } else {
      visualState = 'available';
    }

    previousModuleComplete = totalLessons > 0 && completedLessons === totalLessons;

    return {
      ...module,
      lessons: lessonsWithState,
      visualState,
      percentComplete,
      completedLessons,
      totalLessons,
      badge: badgeByModule.get(module.id) ?? null,
    };
  });
}

export function buildTrailSnapshot(
  modules: DiscipleshipModuleWithLessons[],
  badges: UserDiscipleshipBadge[]
): DiscipleshipTrailSnapshot {
  const { completed, total, percent } = countCompletedLessons(modules);
  const trailBadge = badges.find((b) => b.badge_code === 'trail_complete') ?? null;

  return {
    modules,
    badges,
    percentComplete: percent,
    completedLessons: completed,
    totalLessons: total,
    trailComplete: total > 0 && completed === total,
    trailBadge,
  };
}

export function visualStateLabel(state: DiscipleshipVisualState): string {
  switch (state) {
    case 'locked':
      return 'Bloqueado';
    case 'available':
      return 'Disponível';
    case 'in_progress':
      return 'Em andamento';
    case 'completed':
      return 'Concluído';
    default:
      return 'Disponível';
  }
}

export type DiscipleshipAchievementSlot = {
  key: string;
  stepOrder: number;
  title: string;
  meaning: string;
  color: string;
  unlocked: boolean;
  badge: UserDiscipleshipBadge | null;
  isTrailFinale: boolean;
};

/** Galeria dos 5 selos + selo dourado final (bloqueados em cinza até conquistar). */
export function buildDiscipleshipAchievementSlots(
  modules: DiscipleshipModuleWithLessons[],
  badges: UserDiscipleshipBadge[]
): DiscipleshipAchievementSlot[] {
  const moduleByOrder = new Map(modules.map((module) => [module.sort_order, module]));
  const trailBadge = badges.find((badge) => badge.badge_code === 'trail_complete') ?? null;

  const slots: DiscipleshipAchievementSlot[] = ([1, 2, 3, 4, 5] as const).map((step) => {
    const meta = DISCIPLESHIP_STEP_BADGE_META[step];
    const module = moduleByOrder.get(step) ?? null;
    const badge =
      module?.badge
      ?? badges.find(
        (item) => item.badge_code === 'module_complete' && Number(item.step_order) === step
      )
      ?? null;
    const unlocked = Boolean(badge) || module?.visualState === 'completed';
    return {
      key: `step-${step}`,
      stepOrder: step,
      title: module?.title ? `Passo ${step}` : meta.label,
      meaning: module?.title ?? meta.meaning,
      color: unlocked
        ? badge?.badge_color || discipleshipBadgeColorForStep(step)
        : DISCIPLESHIP_LOCKED_BADGE_COLOR,
      unlocked,
      badge,
      isTrailFinale: false,
    };
  });

  const trailUnlocked = Boolean(trailBadge);
  slots.push({
    key: 'trail-complete',
    stepOrder: 5,
    title: 'Trilha completa',
    meaning: 'Selo dourado de honra — jornada concluída',
    color: trailUnlocked ? DISCIPLESHIP_TRAIL_GOLD_COLOR : DISCIPLESHIP_LOCKED_BADGE_COLOR,
    unlocked: trailUnlocked,
    badge: trailBadge,
    isTrailFinale: true,
  });

  return slots;
}

export async function fetchDiscipleshipModulesWithLessons(): Promise<
  Array<DiscipleshipModule & { lessons: DiscipleshipLessonWithProgress[] }>
> {
  const tenantId = (await getStoredTenantId())?.trim() || null;
  if (!tenantId) {
    throw new Error('Igreja da sessão não identificada. Selecione a igreja e tente novamente.');
  }

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
    .eq('tenant_id', tenantId)
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
          visualState: 'available' as DiscipleshipVisualState,
        }))
        .filter((lesson) => lesson.tenant_id === tenantId)
        .sort((a, b) => a.sort_order - b.sort_order),
    };
  });
}

export async function fetchMyDiscipleshipProgress(
  profileId?: string
): Promise<UserDiscipleshipProgress[]> {
  const effectiveProfileId = profileId ?? (await resolveEffectiveProfileId());
  if (!effectiveProfileId) {
    return [];
  }

  const tenantId = (await getStoredTenantId())?.trim() || null;
  let query = supabase
    .from('user_discipleship_progress')
    .select(PROGRESS_COLUMNS)
    .eq('profile_id', effectiveProfileId);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProgressRow);
}

export async function fetchMyDiscipleshipBadges(
  profileId?: string
): Promise<UserDiscipleshipBadge[]> {
  const effectiveProfileId = profileId ?? (await resolveEffectiveProfileId());
  if (!effectiveProfileId) {
    return [];
  }

  const tenantId = (await getStoredTenantId())?.trim() || null;
  let query = supabase
    .from('user_discipleship_badges')
    .select(BADGE_COLUMNS)
    .eq('profile_id', effectiveProfileId)
    .order('earned_at', { ascending: true });

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;

  if (error) {
    if (isSupabaseRpcMissingError(error, 'user_discipleship_badges') || isMissingRelation(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map(mapBadgeRow);
}

/**
 * Garante seed 5×3 no tenant da sessão (no-op se RPC ausente).
 */
export async function ensureDiscipleshipTrailForSession(): Promise<void> {
  const { error } = await supabase.rpc('ensure_discipleship_trail_for_session');
  if (error && !isSupabaseRpcMissingError(error, 'ensure_discipleship_trail_for_session')) {
    console.warn('ensure_discipleship_trail_for_session:', error.message);
  }
}

/**
 * Trilha completa com % e estados visuais do usuário logado.
 */
export async function fetchDiscipleshipTrailForCurrentUser(): Promise<DiscipleshipTrailSnapshot> {
  await ensureDiscipleshipTrailForSession();
  const [modulesRaw, progressRows, badges] = await Promise.all([
    fetchDiscipleshipModulesWithLessons(),
    fetchMyDiscipleshipProgress(),
    fetchMyDiscipleshipBadges(),
  ]);

  const progressByLesson = new Map(progressRows.map((row) => [row.lesson_id, row]));

  const withProgress = modulesRaw.map((module) => ({
    ...module,
    lessons: module.lessons.map((lesson) => ({
      ...lesson,
      progress: progressByLesson.get(lesson.id) ?? null,
    })),
  }));

  const modules = enrichTrailWithVisualState(withProgress, badges);
  return buildTrailSnapshot(modules, badges);
}

/** @deprecated use fetchDiscipleshipTrailForCurrentUser */
export async function fetchDiscipleshipModulesWithProgressLegacy(): Promise<
  DiscipleshipModuleWithLessons[]
> {
  const snapshot = await fetchDiscipleshipTrailForCurrentUser();
  return snapshot.modules;
}

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

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'upsert_my_discipleship_lesson_progress',
    {
      p_lesson_id: input.lessonId,
      p_status: input.status,
      p_reflection_answer: input.reflectionAnswer ?? null,
    }
  );

  if (!rpcError) {
    const payload = rpcData as {
      success?: boolean;
      message?: string;
      progress?: Record<string, unknown>;
    } | null;
    if (!payload?.success || !payload.progress) {
      throw new Error(payload?.message || 'Não foi possível atualizar o progresso da Trilha.');
    }
    return mapProgressRow({
      id: String(payload.progress.id),
      tenant_id: String(payload.progress.tenant_id),
      profile_id: String(payload.progress.profile_id),
      lesson_id: String(payload.progress.lesson_id),
      status: String(payload.progress.status),
      reflection_answer:
        payload.progress.reflection_answer == null
          ? null
          : String(payload.progress.reflection_answer),
      started_at:
        payload.progress.started_at == null ? null : String(payload.progress.started_at),
      completed_at:
        payload.progress.completed_at == null ? null : String(payload.progress.completed_at),
    });
  }

  if (!isSupabaseRpcMissingError(rpcError, 'upsert_my_discipleship_lesson_progress')) {
    throw new Error(rpcError.message || 'Falha ao atualizar progresso da Trilha.');
  }

  // Fallback legado (antes do patch de gates)
  const existing = await supabase
    .from('user_discipleship_progress')
    .select('started_at')
    .eq('tenant_id', input.tenantId)
    .eq('profile_id', effectiveProfileId)
    .eq('lesson_id', input.lessonId)
    .maybeSingle();

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    profile_id: effectiveProfileId,
    lesson_id: input.lessonId,
    status: input.status,
    reflection_answer: input.reflectionAnswer ?? null,
    completed_at: input.status === 'completed' ? now : null,
  };

  if (input.status === 'not_started') {
    payload.started_at = null;
  } else {
    payload.started_at = existing.data?.started_at ?? now;
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

/**
 * Conclui (ou atualiza) uma lição e detecta conquistas novas (selo de módulo / trilha).
 * O trigger SQL concede selos e cria o alerta pastoral ao fechar a trilha.
 */
export async function completeLessonWithAchievements(input: {
  lessonId: string;
  tenantId: string;
  reflectionAnswer?: string | null;
  profileId?: string;
  status?: DiscipleshipProgressStatus;
}): Promise<{
  progress: UserDiscipleshipProgress;
  snapshot: DiscipleshipTrailSnapshot;
  achievement: DiscipleshipAchievementEvent;
}> {
  const badgesBefore = await fetchMyDiscipleshipBadges(input.profileId);
  const beforeIds = new Set(badgesBefore.map((b) => b.id));

  const progress = await upsertMyLessonProgress({
    lessonId: input.lessonId,
    tenantId: input.tenantId,
    status: input.status ?? 'completed',
    reflectionAnswer: input.reflectionAnswer,
    profileId: input.profileId,
  });

  // Garante avaliação mesmo se o trigger ainda não estiver deployado
  const { error: evalError } = await supabase.rpc('evaluate_discipleship_achievements', {
    p_tenant_id: input.tenantId,
    p_profile_id: progress.profile_id,
    p_lesson_id: input.lessonId,
  });

  if (evalError && !isSupabaseRpcMissingError(evalError, 'evaluate_discipleship_achievements')) {
    console.warn('evaluate_discipleship_achievements:', evalError.message);
  }

  const snapshot = await fetchDiscipleshipTrailForCurrentUser();
  const newBadges = snapshot.badges.filter((b) => !beforeIds.has(b.id));
  const moduleBadge = newBadges.find((b) => b.badge_code === 'module_complete') ?? null;
  const trailBadge = newBadges.find((b) => b.badge_code === 'trail_complete') ?? null;

  return {
    progress,
    snapshot,
    achievement: {
      moduleBadge,
      trailBadge,
      moduleJustCompleted: Boolean(moduleBadge),
      trailJustCompleted: Boolean(trailBadge),
    },
  };
}

export async function fetchDiscipleshipPastoralAlerts(options?: {
  status?: 'new' | 'acknowledged' | 'closed' | 'all';
}): Promise<DiscipleshipPastoralAlert[]> {
  const status = options?.status ?? 'new';

  let query = supabase
    .from('discipleship_pastoral_alerts')
    .select(
      `${ALERT_COLUMNS}, profiles:profile_id ( full_name )`
    )
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRelation(error)) {
      throw Object.assign(new Error(DISCIPLESHIP_TRAIL_SQL_HINT), { cause: error });
    }
    throw error;
  }

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      profile_id: String(row.profile_id),
      alert_type: String(row.alert_type),
      title: String(row.title),
      message: String(row.message),
      status: (['new', 'acknowledged', 'closed'].includes(String(row.status))
        ? row.status
        : 'new') as DiscipleshipPastoralAlert['status'],
      acknowledged_at: row.acknowledged_at == null ? null : String(row.acknowledged_at),
      created_at: String(row.created_at),
      module_id: row.module_id == null ? null : String(row.module_id),
      profile_full_name:
        profile && typeof profile === 'object' && 'full_name' in profile
          ? (profile.full_name as string | null)
          : null,
    };
  });
}

export async function acknowledgeDiscipleshipPastoralAlert(alertId: string): Promise<void> {
  const actorId = await resolveEffectiveProfileId();
  const { error } = await supabase
    .from('discipleship_pastoral_alerts')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_profile_id: actorId,
    })
    .eq('id', alertId);

  if (error) {
    throw error;
  }
}

/** Fecha o alerta pastoral após o reconhecimento/certificado. */
export async function closeDiscipleshipPastoralAlert(alertId: string): Promise<void> {
  const actorId = await resolveEffectiveProfileId();
  const { error } = await supabase
    .from('discipleship_pastoral_alerts')
    .update({
      status: 'closed',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_profile_id: actorId,
    })
    .eq('id', alertId);

  if (error) {
    throw error;
  }
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  const message = (error?.message ?? '').toLowerCase();
  return (
    error?.code === '42P01'
    || error?.code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || message.includes('schema cache')
  );
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

function mapBadgeRow(row: {
  id: string;
  tenant_id: string;
  profile_id: string;
  module_id: string | null;
  badge_code: string;
  badge_title: string;
  badge_description: string | null;
  badge_color?: string | null;
  step_order?: number | null;
  earned_at: string;
}): UserDiscipleshipBadge {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    profile_id: String(row.profile_id),
    module_id: row.module_id == null ? null : String(row.module_id),
    badge_code: row.badge_code === 'trail_complete' ? 'trail_complete' : 'module_complete',
    badge_title: String(row.badge_title),
    badge_description: row.badge_description == null ? null : String(row.badge_description),
    badge_color: row.badge_color == null ? null : String(row.badge_color),
    step_order: row.step_order == null ? null : Number(row.step_order),
    earned_at: String(row.earned_at),
  };
}
