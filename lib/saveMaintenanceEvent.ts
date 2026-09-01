import {
  buildMaintenanceEventReplicationPayload,
  formFromMaintenanceEvent,
  type MaintenanceEventFormState,
  type MaintenanceEventPayload,
} from '@/lib/maintenanceEventForm';
import {
  ensureEventsOptionalColumns,
  getMaintenanceEventSelect,
  isMissingGeofenceAtivoColumnError,
  isMissingRequerQuorumColumnError,
  isMissingSomenteMembrosColumnError,
  isMissingTotemColumnError,
  isMissingEnabledRoomKeysColumnError,
  isGeofenceAtivoColumnAvailable,
  isRequerQuorumColumnAvailable,
  isSomenteMembrosColumnAvailable,
  isTotemAtivoColumnAvailable,
  isEnabledRoomKeysColumnAvailable,
  stripOptionalFieldsFromEventPayload,
  TOTEM_COLUMN_SQL_HINT,
  GEOFENCE_ATIVO_COLUMN_SQL_HINT,
  ENABLED_ROOM_KEYS_COLUMN_SQL_HINT,
} from '@/lib/eventsColumnSupport';
import { fetchEventFavoriteLocations } from '@/lib/eventFavoriteLocationsApi';
import { resolveEventGeofenceCoordinates } from '@/lib/eventGeofenceCoordinates';
import { shouldInvalidateGeofenceEventCheckins, type GeofenceEventSnapshot } from '@/lib/geofenceEventIntegrity';
import { supabase } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export type SaveMaintenanceEventResult =
  | { ok: true; purgedCheckins?: number; purgeWarning?: string }
  | { ok: false; message: string; code?: string };

export const DUPLICATE_EVENT_MESSAGE =
  'Já existe um evento com o mesmo nome, local e data/hora. Altere um desses campos ou edite o evento existente.';

export const DUPLICATE_EVENT_CODE = 'EVENT_DUPLICATE';

const normalizeEventIdentityPart = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

/** Mesmo critério do índice unique: tenant (RLS) + nome + local + event_date. */
const findConflictingEventId = async (
  payload: Pick<MaintenanceEventPayload, 'name' | 'event_local' | 'event_date'>,
  excludeEventId?: string | null
): Promise<string | null> => {
  if (!payload.event_date || !payload.name?.trim()) {
    return null;
  }

  const { data, error } = await supabase
    .from('events')
    .select('id, name, event_local, event_date')
    .eq('event_date', payload.event_date);

  if (error) {
    console.warn('findConflictingEventId:', error.message);
    return null;
  }

  const targetName = normalizeEventIdentityPart(payload.name);
  const targetLocal = normalizeEventIdentityPart(payload.event_local);

  const match = (data ?? []).find((row) => {
    if (excludeEventId && row.id === excludeEventId) {
      return false;
    }
    return (
      normalizeEventIdentityPart(row.name) === targetName
      && normalizeEventIdentityPart(row.event_local) === targetLocal
    );
  });

  return match?.id ?? null;
};

const isUniqueViolationError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) {
    return false;
  }
  if (error.code === '23505') {
    return true;
  }
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('events_tenant_name_local_date_uq')
    || (message.includes('duplicate key') && message.includes('events'))
  );
};

const geofenceColumnMissingError = (): PostgrestError =>
  ({
    message: GEOFENCE_ATIVO_COLUMN_SQL_HINT,
    code: 'GEOFENCE_COLUMN_MISSING',
  }) as PostgrestError;

const assertGeofenceAtivoCanPersist = (payload: MaintenanceEventPayload) => {
  if (payload.geofence_ativo !== true) {
    return null;
  }

  if (isGeofenceAtivoColumnAvailable()) {
    return null;
  }

  return geofenceColumnMissingError();
};

const assertGeofenceLocationHasCoordinates = async (payload: MaintenanceEventPayload) => {
  if (payload.geofence_ativo !== true) {
    return null;
  }

  const locations = await fetchEventFavoriteLocations();

  if (locations.schemaMissing) {
    return 'Locais favoritos indisponíveis. Cadastre um local com latitude e longitude antes do check-in por aproximação.';
  }

  const coordinates = resolveEventGeofenceCoordinates(payload.event_local, locations.rows);

  if (!coordinates) {
    return 'Check-in automático exige um local favorito com latitude e longitude. Selecione um local já cadastrado ou complete as coordenadas em Locais favoritos.';
  }

  return null;
};

const persistEvent = async (
  mode: 'insert' | 'update',
  selectedEventId: string | null,
  payload: MaintenanceEventPayload
) => {
  const row = {
    ...payload,
    ...(payload.totem_ativo !== undefined ? { totem_ativo: payload.totem_ativo === true } : {}),
    ...(payload.requer_quorum !== undefined ? { requer_quorum: payload.requer_quorum === true } : {}),
    ...(payload.somente_membros !== undefined
      ? { somente_membros: payload.somente_membros === true }
      : {}),
    ...(payload.geofence_ativo !== undefined
      ? { geofence_ativo: payload.geofence_ativo === true }
      : {}),
    ...(payload.enabled_room_keys !== undefined
      ? { enabled_room_keys: payload.enabled_room_keys }
      : {}),
  };

  if (mode === 'insert') {
    return supabase.from('events').insert(row);
  }

  if (!selectedEventId) {
    return {
      data: null,
      error: {
        message: 'Nenhum evento selecionado para salvar.',
        code: 'NO_EVENT',
      } as PostgrestError,
    };
  }

  return supabase.from('events').update(row).eq('id', selectedEventId);
};

const saveEventWithOptionalColumnFallback = async (
  mode: 'insert' | 'update',
  selectedEventId: string | null,
  payload: MaintenanceEventPayload
) => {
  const prepared = stripOptionalFieldsFromEventPayload(payload, {
    totem: !isTotemAtivoColumnAvailable(),
    quorum: !isRequerQuorumColumnAvailable(),
    somenteMembros: !isSomenteMembrosColumnAvailable(),
    geofenceAtivo: !isGeofenceAtivoColumnAvailable(),
    enabledRoomKeys: !isEnabledRoomKeysColumnAvailable(),
  }) as MaintenanceEventPayload;

  const geofencePersistError = assertGeofenceAtivoCanPersist(payload);

  if (geofencePersistError) {
    return { data: null, error: geofencePersistError };
  }

  let result = await persistEvent(mode, selectedEventId, prepared);

  if (
    result.error &&
    (isMissingTotemColumnError(result.error) ||
      isMissingRequerQuorumColumnError(result.error) ||
      isMissingSomenteMembrosColumnError(result.error) ||
      isMissingGeofenceAtivoColumnError(result.error) ||
      isMissingEnabledRoomKeysColumnError(result.error))
  ) {
    if (payload.geofence_ativo === true && isMissingGeofenceAtivoColumnError(result.error)) {
      return { data: null, error: geofenceColumnMissingError() };
    }

    if (
      Array.isArray(payload.enabled_room_keys)
      && payload.enabled_room_keys.length > 0
      && isMissingEnabledRoomKeysColumnError(result.error)
    ) {
      return {
        data: null,
        error: {
          message: ENABLED_ROOM_KEYS_COLUMN_SQL_HINT,
          code: 'ENABLED_ROOM_KEYS_MISSING',
        } as PostgrestError,
      };
    }

    const withoutOptionals = stripOptionalFieldsFromEventPayload(prepared, {
      totem: true,
      quorum: true,
      somenteMembros: true,
      geofenceAtivo: true,
      enabledRoomKeys: true,
    }) as MaintenanceEventPayload;
    result = await persistEvent(mode, selectedEventId, withoutOptionals);
  }

  return result;
};

const countEventCheckins = async (eventId: string) => {
  const { count, error } = await supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) {
    console.warn('countEventCheckins:', error.message);
    return 0;
  }

  return count ?? 0;
};

const loadEventSnapshotForGeofence = async (eventId: string) => {
  const { data, error } = await supabase
    .from('events')
    .select(getMaintenanceEventSelect())
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    console.warn('loadEventSnapshotForGeofence:', error.message);
    return null;
  }

  return (data as unknown as GeofenceEventSnapshot | null) ?? null;
};

export const saveMaintenanceEvent = async (
  selectedEventId: string | null,
  payload: MaintenanceEventPayload
): Promise<SaveMaintenanceEventResult> => {
  await ensureEventsOptionalColumns();

  const geofenceLocationError = await assertGeofenceLocationHasCoordinates(payload);

  if (geofenceLocationError) {
    return { ok: false, message: geofenceLocationError, code: 'GEOFENCE_LOCATION' };
  }

  if (selectedEventId === '__new__') {
    const conflictId = await findConflictingEventId(payload);
    if (conflictId) {
      return { ok: false, message: DUPLICATE_EVENT_MESSAGE, code: DUPLICATE_EVENT_CODE };
    }

    const { error } = await saveEventWithOptionalColumnFallback('insert', null, payload);

    if (error) {
      if (isUniqueViolationError(error)) {
        return { ok: false, message: DUPLICATE_EVENT_MESSAGE, code: DUPLICATE_EVENT_CODE };
      }
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: true };
  }

  if (!selectedEventId) {
    return { ok: false, message: 'Nenhum evento selecionado para salvar.' };
  }

  const conflictId = await findConflictingEventId(payload, selectedEventId);
  if (conflictId) {
    return { ok: false, message: DUPLICATE_EVENT_MESSAGE, code: DUPLICATE_EVENT_CODE };
  }

  const existingEvent = await loadEventSnapshotForGeofence(selectedEventId);
  const shouldPurgeCheckins = shouldInvalidateGeofenceEventCheckins(existingEvent, payload);
  const checkinsBeforeSave = shouldPurgeCheckins
    ? await countEventCheckins(selectedEventId)
    : 0;

  const { error } = await saveEventWithOptionalColumnFallback('update', selectedEventId, payload);

  if (error) {
    if (isUniqueViolationError(error)) {
      return { ok: false, message: DUPLICATE_EVENT_MESSAGE, code: DUPLICATE_EVENT_CODE };
    }
    return { ok: false, message: error.message, code: error.code };
  }

  let purgedCheckins = 0;
  let purgeWarning: string | undefined;

  if (shouldPurgeCheckins && checkinsBeforeSave > 0) {
    const remaining = await countEventCheckins(selectedEventId);

    if (remaining > 0) {
      purgeWarning =
        'Evento salvo, mas ainda há check-ins antigos no banco. '
        + 'Execute scripts/geo-checkin-purge-on-event-update.sql no Supabase.';
    } else {
      purgedCheckins = checkinsBeforeSave;
    }
  }

  return {
    ok: true,
    ...(purgedCheckins > 0 ? { purgedCheckins } : {}),
    ...(purgeWarning ? { purgeWarning } : {}),
  };
};

export type ReplicateMaintenanceEventResult =
  | { ok: true; createdCount: number; newEventId?: string | null }
  | { ok: false; message: string; code?: string };

const REPLICATE_EVENT_RPC_HINT =
  'Execute no Supabase: scripts/replicate-event-structure.sql para replicar eventos sem copiar inscrições.';

const parseReplicateRpcResult = (
  data: unknown
): { success: boolean; newEventId?: string | null; message?: string } => {
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Resposta inválida ao replicar evento.' };
  }

  const record = data as Record<string, unknown>;

  return {
    success: record.success === true,
    newEventId: record.new_event_id ? String(record.new_event_id) : null,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
};

const replicateMaintenanceEventViaRpc = async (
  sourceEventId: string,
  dayOffset: number
): Promise<ReplicateMaintenanceEventResult | null> => {
  const { data, error } = await supabase.rpc('replicate_maintenance_event_atomic', {
    p_source_event_id: sourceEventId,
    p_day_offset: dayOffset,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('replicate_maintenance_event_atomic')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      return null;
    }

    return { ok: false, message: error.message, code: error.code };
  }

  const parsed = parseReplicateRpcResult(data);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.message ?? REPLICATE_EVENT_RPC_HINT,
    };
  }

  return {
    ok: true,
    createdCount: 1,
    newEventId: parsed.newEventId ?? null,
  };
};

export const replicateMaintenanceEventForDays = async (
  form: MaintenanceEventFormState,
  dayOffset = 7
): Promise<ReplicateMaintenanceEventResult> => {
  const validation = buildMaintenanceEventReplicationPayload(form, dayOffset);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  await ensureEventsOptionalColumns();

  const conflictId = await findConflictingEventId(validation.payload);
  if (conflictId) {
    return { ok: false, message: DUPLICATE_EVENT_MESSAGE, code: DUPLICATE_EVENT_CODE };
  }

  const { error } = await saveEventWithOptionalColumnFallback('insert', null, validation.payload);

  if (error) {
    if (isUniqueViolationError(error)) {
      return { ok: false, message: DUPLICATE_EVENT_MESSAGE, code: DUPLICATE_EVENT_CODE };
    }
    return {
      ok: false,
      message: error.message,
      code: error.code,
    };
  }

  return { ok: true, createdCount: 1 };
};

export const replicateMaintenanceEventFromRecord = async (
  event: Parameters<typeof formFromMaintenanceEvent>[0],
  dayOffset = 7
): Promise<ReplicateMaintenanceEventResult> => {
  const sourceEventId = event.id?.trim();

  if (sourceEventId) {
    const rpcResult = await replicateMaintenanceEventViaRpc(sourceEventId, dayOffset);

    if (rpcResult) {
      return rpcResult;
    }
  }

  return replicateMaintenanceEventForDays(formFromMaintenanceEvent(event), dayOffset);
};

export type DeleteMaintenanceEventResult =
  | { ok: true; deletedId: string }
  | { ok: false; message: string; code?: string };

export const deleteMaintenanceEvent = async (
  eventId: string
): Promise<DeleteMaintenanceEventResult> => {
  const { data, error } = await supabase.from('events').delete().eq('id', eventId).select('id');

  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  const deletedId = data?.[0]?.id;

  if (!deletedId) {
    return {
      ok: false,
      message:
        'Nenhum registro foi apagado. Execute no Supabase a parte DELETE de scripts/events-maintenance-rls.sql.',
      code: '0_ROWS',
    };
  }

  if (deletedId !== eventId) {
    return {
      ok: false,
      message: 'O servidor apagou um registro diferente do solicitado.',
      code: 'ID_MISMATCH',
    };
  }

  return { ok: true, deletedId };
};

export { TOTEM_COLUMN_SQL_HINT };
