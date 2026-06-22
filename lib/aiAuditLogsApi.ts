import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const AI_AUDIT_LOGS_SQL_HINT = 'Execute no Supabase: scripts/access-control-ai-curator.sql';

export type AiAuditLogRow = {
  id: string;
  userId: string;
  userName: string;
  question: string;
  aiResponse: string;
  roleAtTime: string;
  createdAt: string;
};

const mapAuditRow = (row: Record<string, unknown>): AiAuditLogRow => ({
  id: String(row.id ?? ''),
  userId: String(row.user_id ?? ''),
  userName: String(row.user_name ?? '—'),
  question: String(row.question ?? ''),
  aiResponse: String(row.ai_response ?? ''),
  roleAtTime: String(row.role_at_time ?? ''),
  createdAt: String(row.created_at ?? ''),
});

export async function fetchAiAuditLogs(limit = 100): Promise<AiAuditLogRow[]> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_ai_audit_logs_admin', {
    p_actor_profile_id: actorProfileId,
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_ai_audit_logs_admin')) {
      throw new Error(AI_AUDIT_LOGS_SQL_HINT);
    }

    throw error;
  }

  return (data ?? []).map((row) => mapAuditRow(row as Record<string, unknown>));
}
