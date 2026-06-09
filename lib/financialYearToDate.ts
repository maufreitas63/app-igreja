import { computeFinancialBalance, signedFinancialAmount, type FinancialEntry } from '@/lib/financialEntry';
import { getFinancialMonthDateRange, type FinancialMonthKey } from '@/lib/financialMonth';

/** Saldo REALIZADO acumulado (inclui carry-forward antes do ano). Preferir movimento YTD na UI. */
export const computeYearToDateRealizedBalance = (
  entries: FinancialEntry[],
  month: FinancialMonthKey
) => {
  const { endDate } = getFinancialMonthDateRange(month);
  const yearStart = `${month.year}-01-01`;
  const beforeYear = entries.filter((entry) => entry.transaction_date < yearStart);
  const inYearThroughMonth = entries.filter(
    (entry) => entry.transaction_date >= yearStart && entry.transaction_date <= endDate
  );
  const openingAtYearStart = computeFinancialBalance(beforeYear);
  const movementInYear = inYearThroughMonth.reduce(
    (sum, entry) => sum + signedFinancialAmount(entry),
    0
  );

  return openingAtYearStart + movementInYear;
};

/** Variação líquida REALIZADA de 1º de janeiro até o fim do mês selecionado (ano civil). */
export const computeYearToDateRealizedMovement = (
  entries: FinancialEntry[],
  month: FinancialMonthKey
) => {
  const { endDate } = getFinancialMonthDateRange(month);
  const yearStart = `${month.year}-01-01`;

  return entries
    .filter(
      (entry) => entry.transaction_date >= yearStart && entry.transaction_date <= endDate
    )
    .reduce((sum, entry) => sum + signedFinancialAmount(entry), 0);
};
