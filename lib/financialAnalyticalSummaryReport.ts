import {
  computeFinancialBalance,
  isFinancialMovementExtraordinario,
  signedFinancialAmount,
  type FinancialEntry,
} from '@/lib/financialEntry';
import {
  formatFinancialMonthShortLabel,
  getFinancialMonthDateRange,
  getTrailingFinancialMonths,
  parseFinancialMonthFromDate,
  type FinancialMonthKey,
} from '@/lib/financialMonth';

export type AnalyticalMovementBucket = 'ordinario' | 'extraordinario';

export type AnalyticalPeriodColumn = {
  month: FinancialMonthKey;
  header: string;
  ordinario: number;
  extraordinario: number;
  total: number;
  isFocus: boolean;
};

export type AnalyticalAccountRow = {
  account: string;
  ordinario: number;
  extraordinario: number;
  total: number;
};

export type FinancialAnalyticalSummaryReport = {
  endMonth: FinancialMonthKey;
  periodColumns: AnalyticalPeriodColumn[];
  accountRows: AnalyticalAccountRow[];
  monthTotals: {
    ordinario: number;
    extraordinario: number;
    total: number;
  };
  historical: {
    ordinario: number;
    extraordinario: number;
    saldo: number;
  };
};

const movementBucket = (entry: FinancialEntry): AnalyticalMovementBucket =>
  isFinancialMovementExtraordinario(entry.movement) ? 'extraordinario' : 'ordinario';

/** Conta do relatório = ministério (ALUGUEL, OFERTAS, …), não a conta bancária. */
const reportAccountLabel = (entry: FinancialEntry) => {
  const ministry = entry.ministry?.trim();
  return ministry ? ministry.toUpperCase() : 'OUTROS';
};

const entryInMonth = (entry: FinancialEntry, month: FinancialMonthKey) => {
  const key = parseFinancialMonthFromDate(entry.transaction_date);
  return Boolean(key && key.year === month.year && key.month === month.month);
};

const entryOnOrBeforeMonth = (entry: FinancialEntry, month: FinancialMonthKey) => {
  const { endDate } = getFinancialMonthDateRange(month);
  return entry.transaction_date.slice(0, 10) <= endDate;
};

const sumByBucket = (entries: FinancialEntry[]) => {
  let ordinario = 0;
  let extraordinario = 0;

  for (const entry of entries) {
    const signed = signedFinancialAmount(entry);

    if (movementBucket(entry) === 'extraordinario') {
      extraordinario += signed;
    } else {
      ordinario += signed;
    }
  }

  return {
    ordinario,
    extraordinario,
    total: ordinario + extraordinario,
  };
};

/**
 * Monta o Relatório Analítico / Resumo Financeiro a partir dos lançamentos REALIZADO.
 * - Período: últimos 3 meses (colunas)
 * - Movimentos do mês: por ministério ( Conta ), ordinário / extraordinário / total
 * - Acumulado histórico: até o fim do mês de referência
 */
export function buildFinancialAnalyticalSummaryReport(
  endMonth: FinancialMonthKey,
  realizedEntriesThroughEndMonth: FinancialEntry[]
): FinancialAnalyticalSummaryReport {
  const entriesThrough = realizedEntriesThroughEndMonth.filter((entry) =>
    entryOnOrBeforeMonth(entry, endMonth)
  );

  const periodMonths = getTrailingFinancialMonths(endMonth, 3);
  const periodColumns: AnalyticalPeriodColumn[] = periodMonths.map((month) => {
    const monthEntries = entriesThrough.filter((entry) => entryInMonth(entry, month));
    const totals = sumByBucket(monthEntries);

    return {
      month,
      header: formatFinancialMonthShortLabel(month).toLowerCase(),
      ordinario: totals.ordinario,
      extraordinario: totals.extraordinario,
      total: totals.total,
      isFocus: month.year === endMonth.year && month.month === endMonth.month,
    };
  });

  const focusMonthEntries = entriesThrough.filter((entry) => entryInMonth(entry, endMonth));
  const byAccount = new Map<string, { ordinario: number; extraordinario: number }>();

  for (const entry of focusMonthEntries) {
    const account = reportAccountLabel(entry);
    const current = byAccount.get(account) ?? { ordinario: 0, extraordinario: 0 };
    const signed = signedFinancialAmount(entry);

    if (movementBucket(entry) === 'extraordinario') {
      current.extraordinario += signed;
    } else {
      current.ordinario += signed;
    }

    byAccount.set(account, current);
  }

  const accountRows: AnalyticalAccountRow[] = [...byAccount.entries()]
    .map(([account, values]) => ({
      account,
      ordinario: values.ordinario,
      extraordinario: values.extraordinario,
      total: values.ordinario + values.extraordinario,
    }))
    .sort((left, right) => left.account.localeCompare(right.account, 'pt-BR'));

  const monthTotals = sumByBucket(focusMonthEntries);
  const historicalTotals = sumByBucket(entriesThrough);

  return {
    endMonth,
    periodColumns,
    accountRows,
    monthTotals,
    historical: {
      ordinario: historicalTotals.ordinario,
      extraordinario: historicalTotals.extraordinario,
      saldo: computeFinancialBalance(entriesThrough),
    },
  };
}
