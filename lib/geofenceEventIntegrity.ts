import type { MaintenanceEventPayload } from '@/lib/maintenanceEventForm';

// Contrato espelhado em scripts/geo-checkin-purge-on-event-update.sql
// (geofence_event_has_checkin_relevant_changes). Manter campos em sincronia.

export type GeofenceEventSnapshot = {
  name?: string | null;
  event_date?: string | null;
  event_local?: string | null;
  max_capacity?: number | null;
  kids_room?: boolean | null;
  teens_room?: boolean | null;
  enabled_room_keys?: string[] | null;
  parm_ofertas?: boolean | null;
  totem_ativo?: boolean | null;
  requer_quorum?: boolean | null;
  somente_membros?: boolean | null;
  geofence_ativo?: boolean | null;
};

const bool = (value: boolean | null | undefined) => value === true;

const normalizeKeys = (keys: string[] | null | undefined) =>
  (Array.isArray(keys) ? keys : [])
    .map((key) => String(key ?? '').trim().toUpperCase())
    .filter((key) => /^[A-Z0-9_]{2,40}$/.test(key))
    .sort()
    .join('|');

const sameEventDate = (
  before: string | null | undefined,
  after: string | null | undefined
) => {
  if ((before ?? null) === (after ?? null)) {
    return true;
  }

  if (!before || !after) {
    return false;
  }

  const beforeMs = Date.parse(before);
  const afterMs = Date.parse(after);

  return Number.isFinite(beforeMs) && Number.isFinite(afterMs) && beforeMs === afterMs;
};

export const geofenceEventHasCheckinRelevantChanges = (
  before: GeofenceEventSnapshot,
  after: GeofenceEventSnapshot | MaintenanceEventPayload
) =>
  (before.name ?? '') !== (after.name ?? '')
  || !sameEventDate(before.event_date, after.event_date)
  || (before.event_local ?? null) !== (after.event_local ?? null)
  || (before.max_capacity ?? null) !== (after.max_capacity ?? null)
  || bool(before.kids_room) !== bool(after.kids_room)
  || bool(before.teens_room) !== bool(after.teens_room)
  || normalizeKeys(before.enabled_room_keys) !== normalizeKeys(after.enabled_room_keys)
  || bool(before.parm_ofertas) !== bool(after.parm_ofertas)
  || bool(before.totem_ativo) !== bool(after.totem_ativo)
  || bool(before.requer_quorum) !== bool(after.requer_quorum)
  || bool(before.somente_membros) !== bool(after.somente_membros)
  || bool(before.geofence_ativo) !== bool(after.geofence_ativo);

export const shouldInvalidateGeofenceEventCheckins = (
  before: GeofenceEventSnapshot | null | undefined,
  after: MaintenanceEventPayload
) => {
  const snapshot = before ?? {};
  const geofenceEnabled = snapshot.geofence_ativo === true || after.geofence_ativo === true;

  return geofenceEnabled && geofenceEventHasCheckinRelevantChanges(snapshot, after);
};
