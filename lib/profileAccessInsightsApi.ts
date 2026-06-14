import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PROFILE_ACCESS_INSIGHTS_SQL_HINT =
  'Execute no Supabase: scripts/access-control-profile-access-insights.sql e scripts/profile-access-insights.sql.';

export type ProfileAccessInsightRow = {
  id: string;
  fullName: string;
  lastAccessAt: string | null;
  accessCount: number;
};

export type ProfileAccessScreenVisit = {
  screenKey: string;
  screenLabel: string;
  visitedAt: string;
  visitOrder: number;
};

export type ProfileAccessSessionBlock = {
  accessEventId: string;
  accessedAt: string;
  screens: ProfileAccessScreenVisit[];
};

const parseScreenVisitRows = (data: unknown): ProfileAccessSessionBlock[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  const blocks = new Map<string, ProfileAccessSessionBlock>();

  for (const row of data) {
    const record = row as Record<string, unknown>;
    const accessEventId = String(record.access_event_id ?? record.accessEventId ?? '').trim();
    const rawAccessedAt = record.accessed_at ?? record.accessedAt;
    const accessedAt =
      rawAccessedAt === null || rawAccessedAt === undefined
        ? ''
        : String(rawAccessedAt).trim();

    if (!accessEventId || !accessedAt) {
      continue;
    }

    if (!blocks.has(accessEventId)) {
      blocks.set(accessEventId, {
        accessEventId,
        accessedAt,
        screens: [],
      });
    }

    const screenKey = String(record.screen_key ?? record.screenKey ?? '').trim();
    const screenLabel = String(record.screen_label ?? record.screenLabel ?? screenKey).trim();
    const rawVisitedAt = record.visited_at ?? record.visitedAt;
    const visitedAt =
      rawVisitedAt === null || rawVisitedAt === undefined
        ? ''
        : String(rawVisitedAt).trim();
    const visitOrder = Number(record.visit_order ?? record.visitOrder ?? 0);

    if (!screenKey) {
      continue;
    }

    blocks.get(accessEventId)?.screens.push({
      screenKey,
      screenLabel: screenLabel || screenKey,
      visitedAt,
      visitOrder: Number.isFinite(visitOrder) ? Math.trunc(visitOrder) : 0,
    });
  }

  return Array.from(blocks.values())
    .map((block) => ({
      ...block,
      screens: [...block.screens].sort((left, right) => left.visitOrder - right.visitOrder),
    }))
    .sort((left, right) => right.accessedAt.localeCompare(left.accessedAt));
};

const parseRows = (data: unknown): ProfileAccessInsightRow[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = String(record.profile_id ?? record.profileId ?? '').trim();
      const fullName = String(record.full_name ?? record.fullName ?? '').trim();

      if (!id || !fullName) {
        return null;
      }

      const rawLastAccess = record.last_access_at ?? record.lastAccessAt;
      const lastAccessAt =
        rawLastAccess === null || rawLastAccess === undefined
          ? null
          : String(rawLastAccess).trim() || null;

      const accessCount = Number(record.access_count ?? record.accessCount ?? 0);

      return {
        id,
        fullName,
        lastAccessAt,
        accessCount: Number.isFinite(accessCount) ? Math.max(0, Math.trunc(accessCount)) : 0,
      } satisfies ProfileAccessInsightRow;
    })
    .filter((row): row is ProfileAccessInsightRow => row !== null)
    .filter((row) => row.accessCount > 0);
};

export async function listProfileAccessInsightsForSuperAdmin(): Promise<{
  rows: ProfileAccessInsightRow[];
  rpcMissing: boolean;
  error: string | null;
}> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return {
      rows: [],
      rpcMissing: false,
      error: 'Sessão inválida. Saia e entre novamente no aplicativo.',
    };
  }

  const { data, error } = await supabase.rpc('list_profile_access_insights_admin', {
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_profile_access_insights_admin')) {
      return { rows: [], rpcMissing: true, error: PROFILE_ACCESS_INSIGHTS_SQL_HINT };
    }

    return {
      rows: [],
      rpcMissing: false,
      error: error.message || 'Não foi possível carregar o histórico de acessos.',
    };
  }

  return { rows: parseRows(data), rpcMissing: false, error: null };
}

export async function listProfileScreenVisitsForSuperAdmin(targetProfileId: string): Promise<{
  sessions: ProfileAccessSessionBlock[];
  rpcMissing: boolean;
  error: string | null;
}> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return {
      sessions: [],
      rpcMissing: false,
      error: 'Sessão inválida. Saia e entre novamente no aplicativo.',
    };
  }

  const trimmedTargetProfileId = targetProfileId.trim();

  if (!trimmedTargetProfileId) {
    return {
      sessions: [],
      rpcMissing: false,
      error: 'Usuário inválido para consultar histórico de telas.',
    };
  }

  const { data, error } = await supabase.rpc('list_profile_access_screen_visits_admin', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: trimmedTargetProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_profile_access_screen_visits_admin')) {
      return { sessions: [], rpcMissing: true, error: PROFILE_ACCESS_INSIGHTS_SQL_HINT };
    }

    return {
      sessions: [],
      rpcMissing: false,
      error: error.message || 'Não foi possível carregar o histórico de telas.',
    };
  }

  return { sessions: parseScreenVisitRows(data), rpcMissing: false, error: null };
}

export async function clearProfileAccessInsightsForSuperAdmin(): Promise<{
  success: boolean;
  deletedCount: number;
  rpcMissing: boolean;
  error: string | null;
}> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return {
      success: false,
      deletedCount: 0,
      rpcMissing: false,
      error: 'Sessão inválida. Saia e entre novamente no aplicativo.',
    };
  }

  const { data, error } = await supabase.rpc('clear_profile_access_insights_admin', {
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'clear_profile_access_insights_admin')) {
      return {
        success: false,
        deletedCount: 0,
        rpcMissing: true,
        error: PROFILE_ACCESS_INSIGHTS_SQL_HINT,
      };
    }

    return {
      success: false,
      deletedCount: 0,
      rpcMissing: false,
      error: error.message || 'Não foi possível limpar o histórico de acessos.',
    };
  }

  const deletedCount = Number(data);

  return {
    success: true,
    deletedCount: Number.isFinite(deletedCount) ? Math.max(0, Math.trunc(deletedCount)) : 0,
    rpcMissing: false,
    error: null,
  };
}

export function profileMatchesAccessInsightSearch(
  profile: ProfileAccessInsightRow,
  query: string
) {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return true;
  }

  return profile.fullName.toLowerCase().includes(trimmed);
}
