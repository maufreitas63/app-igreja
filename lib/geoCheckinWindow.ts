import {
  EVENT_LOCAL_OFFSET,
  APP_EVENT_TIMEZONE,
  getEventCalendarDate,
  parseEventDateParts,
} from '@/lib/eventDate';

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Lê `check_in_geofence_tempo` (horas inteiras antes do início do evento). */
export const parseGeofenceHoursBeforeParameter = (value: string | null | undefined): number => {
  const trimmed = (value ?? '').trim();

  if (!trimmed) {
    return 0;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

const getEventDayEndInstant = (eventDate: string): Date | null => {
  const eventDay = getEventCalendarDate(eventDate);

  if (!eventDay) {
    return null;
  }

  const [year, month, day] = eventDay.split('-').map((part) => Number.parseInt(part, 10));

  if ([year, month, day].some(Number.isNaN)) {
    return null;
  }

  const end = new Date(
    `${year}-${pad2(month)}-${pad2(day)}T23:59:59${EVENT_LOCAL_OFFSET}`
  );

  return Number.isNaN(end.getTime()) ? null : end;
};

export const getGeofenceCheckinWindowStart = (
  eventDate: string | null | undefined,
  hoursBefore: number
): Date | null => {
  const parts = parseEventDateParts(eventDate);

  if (!parts) {
    return null;
  }

  const safeHours = Math.max(0, hoursBefore);
  return new Date(parts.date.getTime() - safeHours * 60 * 60 * 1000);
};

/**
 * Verdadeiro entre (início do evento − N horas) e o fim do dia do evento (America/Sao_Paulo).
 */
export const isEventWithinGeofenceCheckinWindow = (
  eventDate: string | null | undefined,
  hoursBefore: number,
  now: Date = new Date()
): boolean => {
  if (!eventDate?.trim()) {
    return false;
  }

  const windowStart = getGeofenceCheckinWindowStart(eventDate, hoursBefore);
  const windowEnd = getEventDayEndInstant(eventDate);

  if (!windowStart || !windowEnd) {
    return false;
  }

  const nowMs = now.getTime();

  return nowMs >= windowStart.getTime() && nowMs <= windowEnd.getTime();
};

export const formatGeofenceHoursBeforeLabel = (hoursBefore: number) => {
  if (hoursBefore <= 0) {
    return 'no horário do evento';
  }

  if (hoursBefore === 1) {
    return '1 hora antes do evento';
  }

  return `${hoursBefore} horas antes do evento`;
};

export const formatGeofenceWindowStartLabel = (
  eventDate: string | null | undefined,
  hoursBefore: number
) => {
  const windowStart = getGeofenceCheckinWindowStart(eventDate, hoursBefore);

  if (!windowStart) {
    return null;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_EVENT_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(windowStart)
    .replace(',', ' às');
};
