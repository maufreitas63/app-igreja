import {
  getEventCalendarDate,
  getTodayCalendarDateInAppTimezone,
  isEventDateBeforeToday,
  isEventTodayOrFuture,
} from '@/lib/eventDate';

/** Evento publicado no app: desbloqueado (false ou null). is_locked true = oculto. */
export const isEventPublished = (isLocked: boolean | null | undefined) => isLocked !== true;

/** Eventos recentes ainda aparecem no check-in (ex.: culto de ontem). */
const CHECKIN_PAST_DAYS = 14;

const shiftCalendarDate = (yyyyMmDd: string, days: number) => {
  const [year, month, day] = yyyyMmDd.split('-').map((part) => Number.parseInt(part, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

const isEventWithinRecentPast = (value: string | null | undefined) => {
  const eventDay = getEventCalendarDate(value);
  if (!eventDay) {
    return false;
  }

  const today = getTodayCalendarDateInAppTimezone();
  const minDay = shiftCalendarDate(today, -CHECKIN_PAST_DAYS);

  return eventDay >= minDay && eventDay < today;
};

/** Visível no card Check In / Agenda: publicado e (sem data, futuro/hoje ou até 14 dias atrás). */
export const isEventVisibleForCheckIn = (event: {
  event_date: string | null | undefined;
  is_locked: boolean | null | undefined;
}) => {
  if (!isEventPublished(event.is_locked)) {
    return false;
  }

  if (!event.event_date) {
    return true;
  }

  return isEventTodayOrFuture(event.event_date) || isEventWithinRecentPast(event.event_date);
};

/**
 * Painel de Eventos (Agenda da Família): somente publicados (is_locked false/null)
 * com data de hoje ou futura. Passados ficam is_locked=true no banco e não entram aqui.
 */
export const isEventVisibleInEventPanel = (event: {
  event_date: string | null | undefined;
  is_locked: boolean | null | undefined;
}) => {
  if (!isEventPublished(event.is_locked)) {
    return false;
  }

  if (!event.event_date?.trim()) {
    return false;
  }

  if (isEventDateBeforeToday(event.event_date)) {
    return false;
  }

  return isEventTodayOrFuture(event.event_date);
};

/** @deprecated Use isEventVisibleInEventPanel */
export const isEventVisibleForDashboard = isEventVisibleInEventPanel;
