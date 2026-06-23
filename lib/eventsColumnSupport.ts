import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import type { PostgrestError } from '@supabase/supabase-js';

const EVENT_SELECT_BASE =
  'id, name, event_date, event_local, max_capacity, parm_ofertas, kids_room, teens_room, is_locked';

let totemAtivoColumnAvailable: boolean | null = null;
let requerQuorumColumnAvailable: boolean | null = null;
let somenteMembrosColumnAvailable: boolean | null = null;
let geofenceAtivoColumnAvailable: boolean | null = null;

const buildEventSelect = () => {
  const fields = [EVENT_SELECT_BASE];

  if (totemAtivoColumnAvailable !== false) {
    fields.push('totem_ativo');
  }

  if (requerQuorumColumnAvailable !== false) {
    fields.push('requer_quorum');
  }

  if (somenteMembrosColumnAvailable !== false) {
    fields.push('somente_membros');
  }

  if (geofenceAtivoColumnAvailable !== false) {
    fields.push('geofence_ativo');
  }

  return fields.join(', ');
};

export const getMaintenanceEventSelect = () => buildEventSelect();

export const getActiveEventSelect = () => buildEventSelect();

export const setTotemAtivoColumnAvailable = (available: boolean) => {
  totemAtivoColumnAvailable = available;
};

export const setRequerQuorumColumnAvailable = (available: boolean) => {
  requerQuorumColumnAvailable = available;
};

export const setSomenteMembrosColumnAvailable = (available: boolean) => {
  somenteMembrosColumnAvailable = available;
};

export const setGeofenceAtivoColumnAvailable = (available: boolean) => {
  geofenceAtivoColumnAvailable = available;
};

export const resetTotemColumnAvailabilityCache = () => {
  totemAtivoColumnAvailable = null;
  requerQuorumColumnAvailable = null;
  somenteMembrosColumnAvailable = null;
  geofenceAtivoColumnAvailable = null;
};

export const isTotemAtivoColumnAvailable = () => totemAtivoColumnAvailable === true;

export const isRequerQuorumColumnAvailable = () => requerQuorumColumnAvailable === true;

export const isSomenteMembrosColumnAvailable = () => somenteMembrosColumnAvailable === true;

export const isGeofenceAtivoColumnAvailable = () => geofenceAtivoColumnAvailable === true;

const isMissingColumnError = (
  error: Pick<PostgrestError, 'code' | 'message'> | null,
  columnName: string
) => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();
  const column = columnName.toLowerCase();

  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes(column)
  );
};

export const isMissingTotemColumnError = (error: Pick<PostgrestError, 'code' | 'message'> | null) =>
  isMissingColumnError(error, 'totem_ativo');

export const isMissingRequerQuorumColumnError = (
  error: Pick<PostgrestError, 'code' | 'message'> | null
) => isMissingColumnError(error, 'requer_quorum');

export const isMissingSomenteMembrosColumnError = (
  error: Pick<PostgrestError, 'code' | 'message'> | null
) => isMissingColumnError(error, 'somente_membros');

export const isMissingGeofenceAtivoColumnError = (
  error: Pick<PostgrestError, 'code' | 'message'> | null
) => isMissingColumnError(error, 'geofence_ativo');

export const probeTotemAtivoColumn = async () => {
  const { error } = await supabase.from('events').select('totem_ativo').limit(1);

  if (isMissingTotemColumnError(error)) {
    setTotemAtivoColumnAvailable(false);
    return false;
  }

  if (error) {
    throw error;
  }

  setTotemAtivoColumnAvailable(true);
  return true;
};

export const probeRequerQuorumColumn = async () => {
  const { error } = await supabase.from('events').select('requer_quorum').limit(1);

  if (isMissingRequerQuorumColumnError(error)) {
    setRequerQuorumColumnAvailable(false);
    return false;
  }

  if (error) {
    throw error;
  }

  setRequerQuorumColumnAvailable(true);
  return true;
};

export const probeSomenteMembrosColumn = async () => {
  const { error } = await supabase.from('events').select('somente_membros').limit(1);

  if (isMissingSomenteMembrosColumnError(error)) {
    setSomenteMembrosColumnAvailable(false);
    return false;
  }

  if (error) {
    throw error;
  }

  setSomenteMembrosColumnAvailable(true);
  return true;
};

export const probeGeofenceAtivoColumn = async () => {
  const { error } = await supabase.from('events').select('geofence_ativo').limit(1);

  if (isMissingGeofenceAtivoColumnError(error)) {
    setGeofenceAtivoColumnAvailable(false);
    return false;
  }

  if (error) {
    throw error;
  }

  setGeofenceAtivoColumnAvailable(true);
  return true;
};

export type EventRowWithOptionals = {
  totem_ativo?: boolean | null;
  requer_quorum?: boolean | null;
  somente_membros?: boolean | null;
  geofence_ativo?: boolean | null;
  [key: string]: unknown;
};

/** @deprecated Use withDefaultEventOptionals */
export type EventRowWithOptionalTotem = EventRowWithOptionals;

export const withDefaultEventOptionals = <T extends EventRowWithOptionals>(row: T) => ({
  ...row,
  totem_ativo: row.totem_ativo === true,
  requer_quorum: row.requer_quorum === true,
  somente_membros: row.somente_membros === true,
  geofence_ativo: row.geofence_ativo === true,
});

export const withDefaultTotemAtivo = withDefaultEventOptionals;

export const stripOptionalFieldsFromEventPayload = <T extends Record<string, unknown>>(
  payload: T,
  options: { totem?: boolean; quorum?: boolean; somenteMembros?: boolean; geofenceAtivo?: boolean }
) => {
  const next = { ...payload };

  if (options.totem) {
    delete next.totem_ativo;
  }

  if (options.quorum) {
    delete next.requer_quorum;
  }

  if (options.somenteMembros) {
    delete next.somente_membros;
  }

  if (options.geofenceAtivo) {
    delete next.geofence_ativo;
  }

  return next;
};

export const stripTotemFromEventPayload = <T extends { totem_ativo?: boolean }>(payload: T) => {
  const { totem_ativo: _removed, ...rest } = payload;
  return rest;
};

export const TOTEM_COLUMN_SQL_HINT =
  'Execute uma vez no Supabase o script scripts/events-totem-ativo.sql (habilita criação automática da coluna).';

export const REQUER_QUORUM_COLUMN_SQL_HINT =
  'Execute uma vez no Supabase o script scripts/events-requer-quorum.sql (habilita Requer Quorum).';

export const SOMENTE_MEMBROS_COLUMN_SQL_HINT =
  'Execute uma vez no Supabase o script scripts/events-somente-membros.sql (habilita Somente Membros).';

export const GEOFENCE_ATIVO_COLUMN_SQL_HINT =
  'Execute uma vez no Supabase o script scripts/events-geofence-ativo.sql (habilita Check-in automático por evento).';

export async function ensureEventsTotemAtivoColumn(): Promise<boolean> {
  if (await probeTotemAtivoColumn().catch(() => false)) {
    return true;
  }

  const { error } = await supabase.rpc('ensure_events_totem_ativo_column');

  if (error) {
    if (!isSupabaseRpcMissingError(error, 'ensure_events_totem_ativo_column')) {
      console.warn('ensure_events_totem_ativo_column:', error.message);
    }
    setTotemAtivoColumnAvailable(false);
    return false;
  }

  totemAtivoColumnAvailable = null;
  return probeTotemAtivoColumn().catch(() => false);
}

export async function ensureEventsRequerQuorumColumn(): Promise<boolean> {
  if (await probeRequerQuorumColumn().catch(() => false)) {
    return true;
  }

  const { error } = await supabase.rpc('ensure_events_requer_quorum_column');

  if (error) {
    if (!isSupabaseRpcMissingError(error, 'ensure_events_requer_quorum_column')) {
      console.warn('ensure_events_requer_quorum_column:', error.message);
    }
    setRequerQuorumColumnAvailable(false);
    return false;
  }

  requerQuorumColumnAvailable = null;
  return probeRequerQuorumColumn().catch(() => false);
}

export async function ensureEventsSomenteMembrosColumn(): Promise<boolean> {
  if (await probeSomenteMembrosColumn().catch(() => false)) {
    return true;
  }

  const { error } = await supabase.rpc('ensure_events_somente_membros_column');

  if (error) {
    if (!isSupabaseRpcMissingError(error, 'ensure_events_somente_membros_column')) {
      console.warn('ensure_events_somente_membros_column:', error.message);
    }
    setSomenteMembrosColumnAvailable(false);
    return false;
  }

  somenteMembrosColumnAvailable = null;
  return probeSomenteMembrosColumn().catch(() => false);
}

export async function ensureEventsGeofenceAtivoColumn(): Promise<boolean> {
  if (await probeGeofenceAtivoColumn().catch(() => false)) {
    return true;
  }

  const { error } = await supabase.rpc('ensure_events_geofence_ativo_column');

  if (error) {
    if (!isSupabaseRpcMissingError(error, 'ensure_events_geofence_ativo_column')) {
      console.warn('ensure_events_geofence_ativo_column:', error.message);
    }
    setGeofenceAtivoColumnAvailable(false);
    return false;
  }

  geofenceAtivoColumnAvailable = null;
  const probed = await probeGeofenceAtivoColumn().catch(() => false);

  if (probed) {
    return true;
  }

  // RPC criou a coluna, mas o cache do PostgREST pode demorar a atualizar.
  setGeofenceAtivoColumnAvailable(true);
  return true;
}

/** Garante colunas opcionais de eventos (totem_ativo, requer_quorum, somente_membros, geofence_ativo). */
export async function ensureEventsOptionalColumns() {
  const [totem, quorum, somenteMembros, geofenceAtivo] = await Promise.all([
    ensureEventsTotemAtivoColumn(),
    ensureEventsRequerQuorumColumn(),
    ensureEventsSomenteMembrosColumn(),
    ensureEventsGeofenceAtivoColumn(),
  ]);

  return { totem, quorum, somenteMembros, geofenceAtivo };
}
