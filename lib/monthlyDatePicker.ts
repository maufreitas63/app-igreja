export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const MONTH_NAMES_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const MONTH_NAMES_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

export const WEEKDAY_LABELS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

export function parseEventDateOnlyInputParts(value: string): CalendarDateParts | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  let year = Number.parseInt(match[3], 10);

  if (match[3].length === 2) {
    year += year >= 70 ? 1900 : 2000;
  }

  if (
    [day, month, year].some(Number.isNaN)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return null;
  }

  const maxDay = new Date(year, month, 0).getDate();
  if (day > maxDay) {
    return null;
  }

  return { year, month, day };
}

export function parseIsoCalendarDate(value: string): CalendarDateParts | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if ([year, month, day].some(Number.isNaN) || month < 1 || month > 12 || day < 1) {
    return null;
  }

  return { year, month, day };
}

export function formatEventDateOnlyFromParts(parts: CalendarDateParts) {
  const yearSuffix = String(parts.year).slice(-2);
  return `${pad2(parts.day)}/${pad2(parts.month)}/${yearSuffix}`;
}

export function formatPickerSelectedDateLabel(parts: CalendarDateParts) {
  const monthLabel = MONTH_NAMES_SHORT[parts.month - 1] ?? '';
  return `${parts.day} de ${monthLabel} de ${parts.year}`;
}

export function formatMonthYearLabel(year: number, month: number) {
  const monthLabel = MONTH_NAMES_LONG[month - 1] ?? '';
  return `${monthLabel} de ${year}`;
}

export function shiftCalendarMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function clampCalendarDay(year: number, month: number, day: number) {
  return Math.min(day, getDaysInMonth(year, month));
}

export function buildMonthCalendarGrid(year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const cells: Array<number | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function chunkCalendarGrid(cells: Array<number | null>) {
  const weeks: Array<Array<number | null>> = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}
