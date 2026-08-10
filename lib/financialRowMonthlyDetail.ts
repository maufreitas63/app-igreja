import { buildFinancialBulletin } from '@/lib/financialBulletin';
import { flattenBulletinRows } from '@/lib/financialBulletinComparison';
import { computeFinancialBalance, type FinancialEntry } from '@/lib/financialEntry';
import {
  compareFinancialMonthKeys,
  formatFinancialMonthKey,
  getFinancialMonthDateRange,
  listFinancialMonthsFromDates,
  type FinancialMonthKey,
} from '@/lib/financialMonth';

export type FinancialRowMonthlyValue = {
  month: FinancialMonthKey;
  value: number;
};

/**
 * Série mensal de uma linha do boletim (ex.: conta OFERTAS) até `endMonth`.
 * Inclui só meses com valor != 0, ordem decrescente (mais recente primeiro).
 */
export const buildBulletinRowMonthlyValues = (
  rowKey: string,
  endMonth: FinancialMonthKey,
  realizedEntries: FinancialEntry[]
): FinancialRowMonthlyValue[] => {
  const months = listFinancialMonthsFromDates(
    realizedEntries.map((entry) => entry.transaction_date)
  )
    .filter((month) => compareFinancialMonthKeys(month, endMonth) <= 0)
    .sort((left, right) => compareFinancialMonthKeys(right, left));

  // Garante o mês de referência mesmo sem lançamentos nesse mês (útil p/ saldos).
  const endKey = formatFinancialMonthKey(endMonth);
  if (!months.some((month) => formatFinancialMonthKey(month) === endKey)) {
    months.unshift(endMonth);
  }

  const details: FinancialRowMonthlyValue[] = [];

  for (const month of months) {
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

    const amount =
      flattenBulletinRows(bulletin).find((row) => row.key === rowKey)?.amount ?? 0;

    if (Math.abs(amount) > 0.009) {
      details.push({ month, value: amount });
    }
  }

  return details;
};
