import { coerceRpcBoolean, isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import { supabase } from '@/lib/supabase';
import { mapProfileSearchRows } from '@/lib/profileSearchRow';
import type { AccessProfileSearchResult } from '@/lib/maintenanceAccessControlApi';
import { resolveRealSessionProfileId } from '@/lib/sessionProfile';

export const GHOST_MODE_AUDITOR_RESOURCE = 'maintenance.card.auditor';

export const GHOST_MODE_SQL_HINT =
  'Execute no Supabase: scripts/access-control-ghost-mode.sql e recarregue o schema (Settings → API).';

export type GhostModeProfileOption = AccessProfileSearchResult;

const parseGhostProfiles = (data: unknown): GhostModeProfileOption[] => mapProfileSearchRows(data);

export async function checkSessionCanOperateGhostMode(): Promise<boolean> {
  const realProfileId = await resolveRealSessionProfileId();

  if (!realProfileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('can_operate_ghost_mode', {
    p_profile_id: realProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissing(error.message ?? '', 'can_operate_ghost_mode')) {
      return false;
    }

    console.error('can_operate_ghost_mode:', error);
    return false;
  }

  return coerceRpcBoolean(data);
}

export async function listActiveProfilesForGhostMode(limit = 5000): Promise<GhostModeProfileOption[]> {
  const operatorProfileId = await resolveRealSessionProfileId();

  if (!operatorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_perfis_ghost_mode', {
    p_operator_profile_id: operatorProfileId,
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissing(error.message ?? '', 'listar_perfis_ghost_mode')) {
      throw new Error(GHOST_MODE_SQL_HINT);
    }

    throw error;
  }

  return parseGhostProfiles(data);
}

export async function registerGhostModeAuditEvent(
  eventType: 'started' | 'ended',
  options: {
    targetProfileId?: string | null;
    targetFullName?: string | null;
    details?: Record<string, unknown>;
  } = {}
) {
  const operatorProfileId = await resolveRealSessionProfileId();

  if (!operatorProfileId) {
    return { success: false as const, message: 'Sessão inválida.' };
  }

  const { data, error } = await supabase.rpc('registrar_evento_ghost_mode', {
    p_operator_profile_id: operatorProfileId,
    p_event_type: eventType,
    p_target_profile_id: options.targetProfileId ?? null,
    p_details: {
      ...(options.details ?? {}),
      target_full_name: options.targetFullName ?? null,
    },
  });

  if (error) {
    if (isSupabaseRpcMissing(error.message ?? '', 'registrar_evento_ghost_mode')) {
      return { success: false as const, message: GHOST_MODE_SQL_HINT };
    }

    return {
      success: false as const,
      message: error.message ?? 'Não foi possível registrar auditoria do Modo Ghost.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return {
    success: record.success === true,
    message:
      typeof record.message === 'string'
        ? record.message
        : eventType === 'started'
          ? 'Modo Ghost iniciado.'
          : 'Modo Ghost encerrado.',
  };
}
