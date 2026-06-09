import { buildFinancialBulletin } from '@/lib/financialBulletin';
import { buildCanonicalBulletinRowStructure } from '@/lib/financialBulletinLayout';
import {
  flattenBulletinRows,
  type BulletinComparisonRowLevel,
  type FlatBulletinRow,
} from '@/lib/financialBulletinComparison';
import { computeFinancialBalance, type FinancialEntry } from '@/lib/financialEntry';
import {
  formatFinancialMonthShortLabel,
  getFinancialMonthDateRange,
  getTrailingFinancialMonths,
  type FinancialMonthKey,
} from '@/lib/financialMonth';

export type TwelveMonthMatrixRow = {
  key: string;
  label: string;
  level: BulletinComparisonRowLevel;
  values: number[];
};

export type TwelveMonthMatrixColumn = {
  month: FinancialMonthKey;
  header: string;
};

export type TwelveMonthMatrix = {
  columns: TwelveMonthMatrixColumn[];
  rows: TwelveMonthMatrixRow[];
};

const TWELVE_MONTH_COUNT = 12;

const mergeMonthFlatRows = (monthsFlat: FlatBulletinRow[][]): TwelveMonthMatrixRow[] => {
  const structure = buildCanonicalBulletinRowStructure(monthsFlat);

  return structure.map((slot) => ({
    key: slot.key,
    label: slot.label,
    level: slot.level,
    values: monthsFlat.map((flatRows) => {
      const match = flatRows.find((row) => row.key === slot.key);
      return match?.amount ?? 0;
    }),
  }));
};

export const formatTwelveMonthPeriodLabel = (columns: TwelveMonthMatrixColumn[]) => {
  if (!columns.length) {
    return 'Últimos 12 meses';
  }

  const first = columns[0].header;
  const last = columns[columns.length - 1].header;

  if (first === last) {
    return first;
  }

  return `${first} a ${last}`;
};

export const buildFinancialTwelveMonthMatrix = (
  endMonth: FinancialMonthKey,
  realizedEntries: FinancialEntry[]
): TwelveMonthMatrix => {
  const months = getTrailingFinancialMonths(endMonth, TWELVE_MONTH_COUNT);
  const columns: TwelveMonthMatrixColumn[] = months.map((month) => ({
    month,
    header: formatFinancialMonthShortLabel(month),
  }));

  const flatRowsByMonth = months.map((month) => {
    const { startDate, endDate } = getFinancialMonthDateRange(month);
    const monthEntries = realizedEntries.filter(
      (row) => row.transaction_date >= startDate && row.transaction_date <= endDate
    );
    const entriesBeforeMonth = realizedEntries.filter((row) => row.transaction_date < startDate);
    const entriesThroughMonth = realizedEntries.filter((row) => row.transaction_date <= endDate);

    const bulletin = buildFinancialBulletin(monthEntries, month, {
      previousBalance: computeFinancialBalance(entriesBeforeMonth),
      currentBalance: computeFinancialBalance(entriesThroughMonth),
    });

    return flattenBulletinRows(bulletin);
  });

  return {
    columns,
    rows: mergeMonthFlatRows(flatRowsByMonth),
  };
};
