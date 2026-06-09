type ParsedEventDateParts = {
  date: Date;
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
};

export const parseEventDateParts = (value: string | null | undefined): ParsedEventDateParts | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (match) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
    const yearNumber = Number.parseInt(year, 10);
    const monthNumber = Number.parseInt(month, 10);
    const dayNumber = Number.parseInt(day, 10);
    const parsedDate = new Date(
      yearNumber,
      monthNumber - 1,
      dayNumber,
      Number.parseInt(hour, 10),
      Number.parseInt(minute, 10),
      Number.parseInt(second, 10)
    );

    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        date: parsedDate,
        year: yearNumber,
        month: monthNumber,
        day: dayNumber,
        hour,
        minute,
      };
    }
  }

  const fallback = new Date(normalized);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return {
    date: fallback,
    year: fallback.getFullYear(),
    month: fallback.getMonth() + 1,
    day: fallback.getDate(),
    hour: String(fallback.getHours()).padStart(2, '0'),
    minute: String(fallback.getMinutes()).padStart(2, '0'),
  };
};

/** Mesmo fuso usado em `scripts/events-auto-lock-past.sql`. */
export const APP_EVENT_TIMEZONE = 'America/Sao_Paulo';

const toCalendarDateInAppTimezone = (instant: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

export const getTodayCalendarDateInAppTimezone = () => toCalendarDateInAppTimezone(new Date());

export const getEventCalendarDate = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return null;
  }

  const parts = parseEventDateParts(value);
  if (parts) {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  const instant = new Date(value.trim());
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return toCalendarDateInAppTimezone(instant);
};

/** Data do evento anterior ao dia atual (calendário America/Sao_Paulo). */
export const isEventDateBeforeToday = (value: string | null | undefined) => {
  const eventDay = getEventCalendarDate(value);
  if (!eventDay) {
    return false;
  }

  return eventDay < getTodayCalendarDateInAppTimezone();
};

const MONTH_NAMES_PT_BR = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export const isEventTodayOrFuture = (value: string | null | undefined) => {
  const eventDay = getEventCalendarDate(value);
  if (!eventDay) {
    return false;
  }

  return eventDay >= getTodayCalendarDateInAppTimezone();
};

export const formatEventDateTimeLabel = (value: string | null | undefined) => {
  const eventDate = parseEventDateParts(value);
  if (!eventDate) {
    return '';
  }

  const today = getTodayCalendarDateInAppTimezone();
  const eventDay = getEventCalendarDate(value);
  const time = `${eventDate.hour}:${eventDate.minute}`;

  if (eventDay && eventDay === today) {
    return `Hoje às ${time}`;
  }

  const day = String(eventDate.day).padStart(2, '0');
  const month = MONTH_NAMES_PT_BR[eventDate.month - 1] ?? String(eventDate.month).padStart(2, '0');
  const year = String(eventDate.year).slice(-2);

  return `${day}/${month}/${year} às ${time}`;
};
