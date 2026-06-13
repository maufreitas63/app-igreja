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
