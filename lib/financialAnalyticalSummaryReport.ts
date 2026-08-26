import {
  computeFinancialBalance,
  isFinancialEntrada,
  isFinancialMovementExtraordinario,
  isFinancialSaida,
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

export type AnalyticalAccountKind = 'entrada' | 'saida';

export type AnalyticalKindTotals = {
  ordinario: number;
  extraordinario: number;
  total: number;
};

export type AnalyticalMovementColumn = {
  month: FinancialMonthKey;
  header: string;
  isFocus: boolean;
  entradasOrdinario: number;
  entradasExtraordinario: number;
  entradasTotal: number;
  saidasOrdinario: number;
  saidasExtraordinario: number;
  saidasTotal: number;
  totalGeral: number;
};

export type AnalyticalAccountRow = {
  account: string;
  kind: AnalyticalAccountKind;
  ordinario: number;
  extraordinario: number;
  total: number;
};

export type FinancialAnalyticalSummaryReport = {
  endMonth: FinancialMonthKey;
  movementColumns: AnalyticalMovementColumn[];
  entradaRows: AnalyticalAccountRow[];
  saidaRows: AnalyticalAccountRow[];
  monthTotals: {
    entradas: AnalyticalKindTotals;
    saidas: AnalyticalKindTotals;
    geral: AnalyticalKindTotals;
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

const emptyKindTotals = (): AnalyticalKindTotals => ({
  ordinario: 0,
  extraordinario: 0,
  total: 0,
});

const addSignedToKindTotals = (target: AnalyticalKindTotals, entry: FinancialEntry) => {
  const signed = signedFinancialAmount(entry);

  if (movementBucket(entry) === 'extraordinario') {
    target.extraordinario += signed;
  } else {
    target.ordinario += signed;
  }

  target.total = target.ordinario + target.extraordinario;
};

const sumKindSplit = (entries: FinancialEntry[]) => {
  const entradas = emptyKindTotals();
  const saidas = emptyKindTotals();

  for (const entry of entries) {
    if (isFinancialEntrada(entry.transaction_kind)) {
      addSignedToKindTotals(entradas, entry);
    } else if (isFinancialSaida(entry.transaction_kind)) {
      addSignedToKindTotals(saidas, entry);
    }
  }

  return {
    entradas,
    saidas,
    geral: {
      ordinario: entradas.ordinario + saidas.ordinario,
      extraordinario: entradas.extraordinario + saidas.extraordinario,
      total: entradas.total + saidas.total,
    },
  };
};

const sortAccountRows = (rows: AnalyticalAccountRow[]) =>
  [...rows].sort((left, right) => left.account.localeCompare(right.account, 'pt-BR'));

/**
 * Monta o Resumo Financeiro a partir dos lançamentos REALIZADO.
 * - Movimentos do mês: entradas com subtotal, depois saídas com subtotal, depois total geral
 * - Últimos 3 meses: entradas e saídas (ordinário / extraordinário / total) + total geral
 * - Saldo acumulado histórico: até o fim do mês de referência
 */
export function buildFinancialAnalyticalSummaryReport(
  endMonth: FinancialMonthKey,
  realizedEntriesThroughEndMonth: FinancialEntry[]
): FinancialAnalyticalSummaryReport {
  const entriesThrough = realizedEntriesThroughEndMonth.filter((entry) =>
    entryOnOrBeforeMonth(entry, endMonth)
  );

  const periodMonths = getTrailingFinancialMonths(endMonth, 3);

  const movementColumns: AnalyticalMovementColumn[] = periodMonths.map((month) => {
    const monthEntries = entriesThrough.filter((entry) => entryInMonth(entry, month));
    const split = sumKindSplit(monthEntries);

    return {
      month,
      header: formatFinancialMonthShortLabel(month).toLowerCase(),
      isFocus: month.year === endMonth.year && month.month === endMonth.month,
      entradasOrdinario: split.entradas.ordinario,
      entradasExtraordinario: split.entradas.extraordinario,
      entradasTotal: split.entradas.total,
      saidasOrdinario: split.saidas.ordinario,
      saidasExtraordinario: split.saidas.extraordinario,
      saidasTotal: split.saidas.total,
      totalGeral: split.geral.total,
    };
  });

  const focusMonthEntries = entriesThrough.filter((entry) => entryInMonth(entry, endMonth));
  const byAccount = new Map<string, AnalyticalAccountRow>();

  for (const entry of focusMonthEntries) {
    const kind: AnalyticalAccountKind | null = isFinancialEntrada(entry.transaction_kind)
      ? 'entrada'
      : isFinancialSaida(entry.transaction_kind)
        ? 'saida'
        : null;

    if (!kind) {
      continue;
    }

    const account = reportAccountLabel(entry);
    const key = `${kind}:${account}`;
    const current = byAccount.get(key) ?? {
      account,
      kind,
      ordinario: 0,
      extraordinario: 0,
      total: 0,
    };
    const signed = signedFinancialAmount(entry);

    if (movementBucket(entry) === 'extraordinario') {
      current.extraordinario += signed;
    } else {
      current.ordinario += signed;
    }

    current.total = current.ordinario + current.extraordinario;
    byAccount.set(key, current);
  }

  const accountRows = [...byAccount.values()];
  const monthTotals = sumKindSplit(focusMonthEntries);
  const historicalTotals = sumByBucket(entriesThrough);

  return {
    endMonth,
    movementColumns,
    entradaRows: sortAccountRows(accountRows.filter((row) => row.kind === 'entrada')),
    saidaRows: sortAccountRows(accountRows.filter((row) => row.kind === 'saida')),
    monthTotals,
    historical: {
      ordinario: historicalTotals.ordinario,
      extraordinario: historicalTotals.extraordinario,
      saldo: computeFinancialBalance(entriesThrough),
    },
  };
}
