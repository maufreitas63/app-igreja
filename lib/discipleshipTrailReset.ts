/**
 * Reset da Trilha — apenas super_admin, escopo da igreja da sessão.
 * SQL: scripts/discipleship-trail-reset-admin.sql
 */

import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const DISCIPLESHIP_RESET_SQL_HINT =
  'Execute no Supabase: scripts/discipleship-trail-reset-admin.sql';

export type DiscipleshipResetCandidate = {
  profile_id: string;
  full_name: string;
  phone: string | null;
  lessons_completed: number;
  has_trail_badge: boolean;
  has_alert: boolean;
};

export async function searchDiscipleshipResetCandidates(
  query: string,
  limit = 20
): Promise<DiscipleshipResetCandidate[]> {
  const { data, error } = await supabase.rpc('search_discipleship_reset_candidates', {
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'search_discipleship_reset_candidates')) {
      throw new Error(DISCIPLESHIP_RESET_SQL_HINT);
    }
    throw error;
  }

  const payload = data as { success?: boolean; message?: string; items?: unknown } | null;
  if (!payload?.success) {
    throw new Error(payload?.message || DISCIPLESHIP_RESET_SQL_HINT);
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      const profileId = String(row.profile_id ?? '').trim();
      const fullName = String(row.full_name ?? '').trim();
      if (!profileId || !fullName) return null;
      return {
        profile_id: profileId,
        full_name: fullName,
        phone: row.phone != null ? String(row.phone) : null,
        lessons_completed: Number(row.lessons_completed ?? 0),
        has_trail_badge: Boolean(row.has_trail_badge),
        has_alert: Boolean(row.has_alert),
      } satisfies DiscipleshipResetCandidate;
    })
    .filter((row): row is DiscipleshipResetCandidate => row !== null);
}

export async function resetDiscipleshipTrailForProfile(profileId: string): Promise<string> {
  const { data, error } = await supabase.rpc('reset_discipleship_trail_for_profile', {
    p_profile_id: profileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'reset_discipleship_trail_for_profile')) {
      throw new Error(DISCIPLESHIP_RESET_SQL_HINT);
    }
    throw error;
  }

  const payload = data as { success?: boolean; message?: string } | null;
  if (!payload?.success) {
    throw new Error(payload?.message || 'Não foi possível resetar a Trilha.');
  }

  return payload.message || 'Trilha reiniciada.';
}
