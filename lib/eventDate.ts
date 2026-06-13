type ParsedEventDateParts = {
  date: Date;
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
};

export type EventWallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Mesmo fuso usado em `scripts/events-auto-lock-past.sql`. */
export const APP_EVENT_TIMEZONE = 'America/Sao_Paulo';

/** Offset fixo de America/Sao_Paulo (sem horário de verão). */
export const EVENT_LOCAL_OFFSET = '-03:00';

const pad2 = (value: number) => String(value).padStart(2, '0');

const WALL_CLOCK_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_EVENT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const pickIntlPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  Number.parseInt(parts.find((part) => part.type === type)?.value ?? '', 10);

/**
 * Interpreta `event_date` como horário de parede da igreja (America/Sao_Paulo).
 * O valor digitado no formulário (ex.: 20:00) é o que volta para tela e gravação.
 */
export function getEventWallClockParts(
  value: string | null | undefined
): EventWallClockParts | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim();
  const literal = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  const hasSpOffset = /(?:-03:00|-0300)$/.test(normalized);
  const isZulu = /Z$/i.test(normalized);
  const hasOtherOffset = /[+-]\d{2}:\d{2}$/.test(normalized) && !hasSpOffset;

  if (literal && (hasSpOffset || (!isZulu && !hasOtherOffset))) {
    const year = Number.parseInt(literal[1], 10);
    const month = Number.parseInt(literal[2], 10);
    const day = Number.parseInt(literal[3], 10);
    const hour = Number.parseInt(literal[4] ?? '0', 10);
    const minute = Number.parseInt(literal[5] ?? '0', 10);

    if ([year, month, day, hour, minute].some(Number.isNaN)) {
      return null;
    }

    return { year, month, day, hour, minute };
  }

  const instant = new Date(normalized);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const formatted = WALL_CLOCK_PARTS_FORMATTER.formatToParts(instant);
  const year = pickIntlPart(formatted, 'year');
  const month = pickIntlPart(formatted, 'month');
  const day = pickIntlPart(formatted, 'day');
  const hour = pickIntlPart(formatted, 'hour');
  const minute = pickIntlPart(formatted, 'minute');

  if ([year, month, day, hour, minute].some(Number.isNaN)) {
    return null;
  }

  return { year, month, day, hour, minute };
}

export const formatEventWallClockIso = (parts: EventWallClockParts) =>
  `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:00${EVENT_LOCAL_OFFSET}`;

export const parseEventDateParts = (value: string | null | undefined): ParsedEventDateParts | null => {
  const wall = getEventWallClockParts(value);
  if (!wall) {
    return null;
  }

  const hour = pad2(wall.hour);
  const minute = pad2(wall.minute);
  const date = new Date(
    `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${hour}:${minute}:00${EVENT_LOCAL_OFFSET}`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    year: wall.year,
    month: wall.month,
    day: wall.day,
    hour,
    minute,
  };
};

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
