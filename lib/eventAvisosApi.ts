import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const EVENT_AVISOS_SQL_HINT = 'Execute no Supabase: scripts/event-avisos-schema.sql';

export type EventAvisoAudience = 'all' | 'small_group_leaders' | 'opportunity_match';

export type EventAvisoRow = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
  audience: EventAvisoAudience;
  opportunityId: string | null;
  createdAt: string;
  updatedAt: string;
};

const parseEventAvisoRow = (record: Record<string, unknown>): EventAvisoRow | null => {
  const id = String(record.id ?? '').trim();
  const body = String(record.body ?? '').trim();

  if (!id || !body) {
    return null;
  }

  const audienceRaw = String(record.audience ?? 'all').trim();
  const audience: EventAvisoAudience =
    audienceRaw === 'small_group_leaders'
      ? 'small_group_leaders'
      : audienceRaw === 'opportunity_match'
        ? 'opportunity_match'
        : 'all';

  return {
    id,
    title: String(record.title ?? '').trim(),
    body,
    sortOrder: Number(record.sort_order ?? record.sortOrder ?? 0),
    isPublished: record.is_published === true || record.isPublished === true,
    audience,
    opportunityId: String(record.opportunity_id ?? '').trim() || null,
    createdAt: String(record.created_at ?? record.createdAt ?? ''),
    updatedAt: String(record.updated_at ?? record.updatedAt ?? ''),
  };
};

export async function fetchPublishedEventAvisos(): Promise<EventAvisoRow[]> {
  const { data, error } = await supabase.rpc('listar_event_avisos_publicados');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_event_avisos_publicados')) {
      throw new Error(EVENT_AVISOS_SQL_HINT);
    }

    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseEventAvisoRow(row as Record<string, unknown>))
    .filter((row): row is EventAvisoRow => row !== null);
}

export async function fetchOrchestratorEventAvisos(): Promise<EventAvisoRow[]> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return [];
  }

  const { data, error } = await supabase.rpc('listar_event_avisos_orquestrador', {
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_event_avisos_orquestrador')) {
      throw new Error(EVENT_AVISOS_SQL_HINT);
    }

    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseEventAvisoRow(row as Record<string, unknown>))
    .filter((row): row is EventAvisoRow => row !== null);
}

export async function saveEventAviso(input: {
  id?: string | null;
  title?: string;
  body: string;
  sortOrder?: number;
  isPublished?: boolean;
  audience?: EventAvisoAudience;
  opportunityId?: string | null;
}) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('salvar_event_aviso', {
    p_actor_profile_id: actorProfileId,
    p_id: input.id ?? null,
    p_title: input.title ?? '',
    p_body: input.body,
    p_sort_order: input.sortOrder ?? 0,
    p_is_published: input.isPublished ?? true,
    p_audience: input.audience ?? 'all',
    p_opportunity_id: input.opportunityId ?? null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'salvar_event_aviso')) {
      throw new Error(EVENT_AVISOS_SQL_HINT);
    }

    return {
      success: false as const,
      message: error.message || 'Não foi possível salvar o aviso.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return {
    success: record.success === true,
    message: String(record.message ?? (record.success === true ? 'Aviso salvo.' : 'Falha ao salvar aviso.')),
    row: parseEventAvisoRow(record),
  } as const;
}

export async function deleteEventAviso(id: string) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('excluir_event_aviso', {
    p_actor_profile_id: actorProfileId,
    p_id: id,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'excluir_event_aviso')) {
      throw new Error(EVENT_AVISOS_SQL_HINT);
    }

    return {
      success: false as const,
      message: error.message || 'Não foi possível excluir o aviso.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return {
    success: record.success === true,
    message: String(record.message ?? (record.success === true ? 'Aviso excluído.' : 'Falha ao excluir aviso.')),
  } as const;
}
