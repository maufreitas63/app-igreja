import type { MaintenanceEventPayload } from '@/lib/maintenanceEventForm';
import {
  ensureEventsOptionalColumns,
  isMissingRequerQuorumColumnError,
  isMissingTotemColumnError,
  isRequerQuorumColumnAvailable,
  isTotemAtivoColumnAvailable,
  stripOptionalFieldsFromEventPayload,
  TOTEM_COLUMN_SQL_HINT,
} from '@/lib/eventsColumnSupport';
import { supabase } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export type SaveMaintenanceEventResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

const persistEvent = async (
  mode: 'insert' | 'update',
  selectedEventId: string | null,
  payload: MaintenanceEventPayload
) => {
  const row = {
    ...payload,
    ...(payload.totem_ativo !== undefined ? { totem_ativo: payload.totem_ativo === true } : {}),
    ...(payload.requer_quorum !== undefined ? { requer_quorum: payload.requer_quorum === true } : {}),
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
  }) as MaintenanceEventPayload;

  let result = await persistEvent(mode, selectedEventId, prepared);

  if (
    result.error &&
    (isMissingTotemColumnError(result.error) || isMissingRequerQuorumColumnError(result.error))
  ) {
    const withoutOptionals = stripOptionalFieldsFromEventPayload(prepared, {
      totem: true,
      quorum: true,
    }) as MaintenanceEventPayload;
    result = await persistEvent(mode, selectedEventId, withoutOptionals);
  }

  return result;
};

export const saveMaintenanceEvent = async (
  selectedEventId: string | null,
  payload: MaintenanceEventPayload
): Promise<SaveMaintenanceEventResult> => {
  await ensureEventsOptionalColumns();

  if (selectedEventId === '__new__') {
    const { error } = await saveEventWithOptionalColumnFallback('insert', null, payload);

    if (error) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: true };
  }

  if (!selectedEventId) {
    return { ok: false, message: 'Nenhum evento selecionado para salvar.' };
  }

  const { error } = await saveEventWithOptionalColumnFallback('update', selectedEventId, payload);

  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  return { ok: true };
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
