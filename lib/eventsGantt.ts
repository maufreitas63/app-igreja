import {
  formatEventDateTimeLabel,
  getEventCalendarDate,
  getTodayCalendarDateInAppTimezone,
  isEventTodayOrFuture,
} from '@/lib/eventDate';
import { isEventPublished } from '@/lib/eventVisibility';

export type GanttSourceEvent = {
  id: string;
  name: string;
  event_date: string | null;
  event_local: string | null;
  is_locked: boolean | null;
};

export type GanttViewMode = 'day' | 'month';

export type GanttDateColumn = {
  key: string;
  dayLabel: string;
  weekdayLabel: string;
  isToday: boolean;
};

export type GanttEventRow = {
  id: string;
  name: string;
  calendarDate: string;
  calendarMonth: string;
  eventDate: string;
  timeLabel: string;
  localLabel: string;
  isPublished: boolean;
};

export type EventsGanttModel = {
  viewMode: GanttViewMode;
  dateColumns: GanttDateColumn[];
  rows: GanttEventRow[];
};

const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const shiftCalendarDate = (yyyyMmDd: string, days: number) => {
  const [year, month, day] = yyyyMmDd.split('-').map((part) => Number.parseInt(part, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

const compareCalendarDates = (left: string, right: string) => left.localeCompare(right);

const toCalendarMonth = (yyyyMmDd: string) => yyyyMmDd.slice(0, 7);

const shiftCalendarMonth = (yyyyMm: string, months: number) => {
  const [year, month] = yyyyMm.split('-').map((part) => Number.parseInt(part, 10));
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Cronograma de manutenção: eventos com data hoje ou futura, publicados ou rascunho.
 * Rascunho = is_locked true (Publicação desligada no formulário do evento).
 */
export const isEventScheduledForMaintenanceGantt = (event: GanttSourceEvent) => {
  if (!event.event_date?.trim()) {
    return false;
  }

  return isEventTodayOrFuture(event.event_date);
};

const buildDayColumns = (calendarDates: string[]): GanttDateColumn[] => {
  const today = getTodayCalendarDateInAppTimezone();

  return calendarDates.map((key) => {
    const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
    const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return {
      key,
      dayLabel: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
      weekdayLabel: WEEKDAY_SHORT_PT[weekdayIndex] ?? '',
      isToday: key === today,
    };
  });
};

const buildMonthColumns = (calendarMonths: string[]): GanttDateColumn[] => {
  const todayMonth = toCalendarMonth(getTodayCalendarDateInAppTimezone());

  return calendarMonths.map((key) => {
    const [, month] = key.split('-').map((part) => Number.parseInt(part, 10));

    return {
      key,
      dayLabel: MONTH_SHORT_PT[month - 1] ?? key,
      weekdayLabel: key.slice(0, 4),
      isToday: key === todayMonth,
    };
  });
};

export const buildEventsGanttModel = (
  events: GanttSourceEvent[],
  viewMode: GanttViewMode = 'day'
): EventsGanttModel | null => {
  const scheduled = (events ?? []).filter(isEventScheduledForMaintenanceGantt);

  if (!scheduled.length) {
    return null;
  }

  const rows: GanttEventRow[] = scheduled
    .map((event) => {
      const calendarDate = getEventCalendarDate(event.event_date);
      if (!calendarDate || !event.event_date) {
        return null;
      }

      return {
        id: event.id,
        name: event.name.trim() || 'Sem nome',
        calendarDate,
        calendarMonth: toCalendarMonth(calendarDate),
        eventDate: event.event_date,
        timeLabel: formatEventDateTimeLabel(event.event_date).split(' às ').pop() ?? '',
        localLabel: event.event_local?.trim() ?? '',
        isPublished: isEventPublished(event.is_locked),
      };
    })
    .filter((row): row is GanttEventRow => row !== null)
    .sort((left, right) => {
      const byDate = compareCalendarDates(left.calendarDate, right.calendarDate);
      if (byDate !== 0) {
        return byDate;
      }

      return left.name.localeCompare(right.name, 'pt-BR');
    });

  if (!rows.length) {
    return null;
  }

  if (viewMode === 'month') {
    const uniqueMonths = [...new Set(rows.map((row) => row.calendarMonth))].sort(compareCalendarDates);
    const rangeStart = uniqueMonths[0];
    const rangeEnd = uniqueMonths[uniqueMonths.length - 1];

    const calendarMonths: string[] = [];
    let cursor = rangeStart;

    while (compareCalendarDates(cursor, rangeEnd) <= 0) {
      calendarMonths.push(cursor);
      cursor = shiftCalendarMonth(cursor, 1);
    }

    return {
      viewMode,
      dateColumns: buildMonthColumns(calendarMonths),
      rows,
    };
  }

  const uniqueDates = [...new Set(rows.map((row) => row.calendarDate))].sort(compareCalendarDates);
  const rangeStart = uniqueDates[0];
  const rangeEnd = uniqueDates[uniqueDates.length - 1];

  const calendarDates: string[] = [];
  let cursor = rangeStart;

  while (compareCalendarDates(cursor, rangeEnd) <= 0) {
    calendarDates.push(cursor);
    cursor = shiftCalendarDate(cursor, 1);
  }

  return {
    viewMode,
    dateColumns: buildDayColumns(calendarDates),
    rows,
  };
};
