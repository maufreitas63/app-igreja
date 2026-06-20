import {
  compareFinancialMonthKeys,
  formatFinancialMonthKey,
  getCalendarMonthKey,
  getFinancialMonthDateRange,
  getNextFinancialMonth,
  getPreviousFinancialMonth,
  parseFinancialMonthFromDate,
  type FinancialMonthKey,
} from '@/lib/financialMonth';

export type MembershipDateRecord = {
  membershipDate: string | null;
  membershipOut: string | null;
};

export type MemberGrowthMonthPoint = {
  month: FinancialMonthKey;
  entries: number;
  exits: number;
  netChange: number;
  activeMembersEnd: number;
};

const parseIsoDate = (value: string | null | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
};

const monthFromIsoDate = (isoDate: string): FinancialMonthKey | null =>
  parseFinancialMonthFromDate(isoDate);

const isActiveAtMonthEnd = (
  record: MembershipDateRecord,
  month: FinancialMonthKey
) => {
  const entryDate = parseIsoDate(record.membershipDate);

  if (!entryDate) {
    return false;
  }

  const { endDate } = getFinancialMonthDateRange(month);

  if (entryDate > endDate) {
    return false;
  }

  const exitDate = parseIsoDate(record.membershipOut);

  if (!exitDate) {
    return true;
  }

  return exitDate > endDate;
};

export const buildMemberGrowthMonthSeries = (
  records: MembershipDateRecord[],
  endMonth: FinancialMonthKey = getCalendarMonthKey(),
  monthsBack = 48
): MemberGrowthMonthPoint[] => {
  const months: FinancialMonthKey[] = [];
  let cursor = endMonth;

  for (let index = 0; index < monthsBack; index += 1) {
    months.unshift(cursor);
    cursor = getPreviousFinancialMonth(cursor);
  }

  return months.map((month) => {
    const monthKey = formatFinancialMonthKey(month);
    let entries = 0;
    let exits = 0;

    for (const record of records) {
      const entryDate = parseIsoDate(record.membershipDate);
      const exitDate = parseIsoDate(record.membershipOut);

      if (entryDate && formatFinancialMonthKey(monthFromIsoDate(entryDate) ?? month) === monthKey) {
        entries += 1;
      }

      if (exitDate && formatFinancialMonthKey(monthFromIsoDate(exitDate) ?? month) === monthKey) {
        exits += 1;
      }
    }

    const activeMembersEnd = records.filter((record) => isActiveAtMonthEnd(record, month)).length;

    return {
      month,
      entries,
      exits,
      netChange: entries - exits,
      activeMembersEnd,
    };
  });
};

export const findEarliestMembershipMonth = (
  records: MembershipDateRecord[]
): FinancialMonthKey | null => {
  let earliest: FinancialMonthKey | null = null;

  for (const record of records) {
    for (const rawDate of [record.membershipDate, record.membershipOut]) {
      const isoDate = parseIsoDate(rawDate);

      if (!isoDate) {
        continue;
      }

      const month = monthFromIsoDate(isoDate);

      if (!month) {
        continue;
      }

      if (!earliest || compareFinancialMonthKeys(month, earliest) < 0) {
        earliest = month;
      }
    }
  }

  return earliest;
};

export const buildMemberGrowthSeriesThroughMonth = (
  records: MembershipDateRecord[],
  startMonth: FinancialMonthKey,
  endMonth: FinancialMonthKey
): MemberGrowthMonthPoint[] => {
  const points: MemberGrowthMonthPoint[] = [];
  let cursor = startMonth;

  while (compareFinancialMonthKeys(cursor, endMonth) <= 0) {
    const monthKey = formatFinancialMonthKey(cursor);
    let entries = 0;
    let exits = 0;

    for (const record of records) {
      const entryDate = parseIsoDate(record.membershipDate);
      const exitDate = parseIsoDate(record.membershipOut);

      if (entryDate && formatFinancialMonthKey(monthFromIsoDate(entryDate) ?? cursor) === monthKey) {
        entries += 1;
      }

      if (exitDate && formatFinancialMonthKey(monthFromIsoDate(exitDate) ?? cursor) === monthKey) {
        exits += 1;
      }
    }

    points.push({
      month: cursor,
      entries,
      exits,
      netChange: entries - exits,
      activeMembersEnd: records.filter((record) => isActiveAtMonthEnd(record, cursor)).length,
    });

    cursor = getNextFinancialMonth(cursor);
  }

  return points;
};
