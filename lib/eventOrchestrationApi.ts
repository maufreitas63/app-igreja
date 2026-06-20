import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import {
  EVENT_CONTROL_ID,
  isEventOrchestrationRouteCode,
  type EventOrchestrationRouteCode,
} from '@/lib/eventOrchestrationRoutes';

export const EVENT_ORCHESTRATION_SQL_HINT =
  'Execute no Supabase: scripts/event-control-orchestration.sql';

export type EventControlRow = {
  id: number;
  activeRoute: EventOrchestrationRouteCode;
  updatedAt: string;
};

const parseEventControlRow = (record: Record<string, unknown> | null | undefined): EventControlRow | null => {
  if (!record) {
    return null;
  }

  const id = Number(record.id);
  const activeRoute = String(record.active_route ?? record.activeRoute ?? '').trim().toLowerCase();
  const updatedAt = String(record.updated_at ?? record.updatedAt ?? '').trim();

  if (id !== EVENT_CONTROL_ID || !isEventOrchestrationRouteCode(activeRoute) || !updatedAt) {
    return null;
  }

  return {
    id,
    activeRoute,
    updatedAt,
  };
};

export async function fetchEventControlState(): Promise<EventControlRow | null> {
  const { data, error } = await supabase
    .from('event_control')
    .select('id, active_route, updated_at')
    .eq('id', EVENT_CONTROL_ID)
    .maybeSingle();

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (message.includes('event_control') && message.includes('does not exist')) {
      throw new Error(EVENT_ORCHESTRATION_SQL_HINT);
    }

    throw error;
  }

  return parseEventControlRow(data as Record<string, unknown> | null);
}

export async function sessionCanManageEventControl() {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('profile_can_manage_event_control', {
    p_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'profile_can_manage_event_control')) {
      return false;
    }

    throw error;
  }

  return data === true;
}

export async function updateEventControlRoute(activeRoute: EventOrchestrationRouteCode) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('atualizar_event_control_rota', {
    p_actor_profile_id: actorProfileId,
    p_active_route: activeRoute,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'atualizar_event_control_rota')) {
      throw new Error(EVENT_ORCHESTRATION_SQL_HINT);
    }

    return {
      success: false as const,
      message: error.message || 'Não foi possível atualizar a rota do evento.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;
  const row = parseEventControlRow({
    id: record.id,
    active_route: record.active_route,
    updated_at: record.updated_at,
  });

  return {
    success: record.success === true,
    message: String(record.message ?? (record.success === true ? 'Rota atualizada.' : 'Falha ao atualizar rota.')),
    row,
  } as const;
}
