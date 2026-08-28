import { computeYearToDateRealizedMovement } from '@/lib/financialYearToDate';
import {
  computeFinancialBalance,
  filterPlannedFinancialEntries,
  filterRealizedFinancialEntries,
  FINANCIAL_BUDGET_VERSION_PLANNED,
  FINANCIAL_BUDGET_VERSION_REALIZED,
  getFinancialEntryComment,
  mergeFinancialComments,
  normalizeFinancialEntryRow,
  pickFinancialEntryComment,
  type FinancialEntry,
} from '@/lib/financialEntry';
import {
  getFinancialEntryReceiptUrls,
  mergeFinancialReceiptUrlsIntoEntries,
} from '@/lib/financialReceiptUrls';
import {
  fetchExpenseReportLinksForFinancialIds,
  mergeExpenseReportLinksIntoFinancialEntries,
} from '@/lib/expenseReport';
import {
  filterSelectableFinancialMonths,
  formatFinancialMonthKey,
  getFinancialMonthDateRange,
  getPreviousFinancialMonth,
  isFinancialMonthBeforeCurrentCalendarMonth,
  listFinancialMonthsFromDates,
  mergeFinancialMonthLists,
  parseFinancialMonthKey,
  resolveDefaultFinancialMonth,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { getGhostModeState, subscribeGhostMode } from '@/lib/ghostMode';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type { FinancialEntry } from '@/lib/financialEntry';

const FINANCIAL_SELECT_BASE =
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version';

const FINANCIAL_SELECT_WITH_COMMENTS = `${FINANCIAL_SELECT_BASE}, comments, receipt_url, receipt_urls`;
const FINANCIAL_SELECT_WITH_COMMENTS_PASCAL = `${FINANCIAL_SELECT_BASE}, Comments, receipt_url, receipt_urls`;
const FINANCIAL_SELECT_WITH_RECEIPT_URL_ONLY = `${FINANCIAL_SELECT_BASE}, comments, receipt_url`;
const FINANCIAL_SELECT_WITH_RECEIPT_URL_ONLY_PASCAL = `${FINANCIAL_SELECT_BASE}, Comments, receipt_url`;
const FINANCIAL_SELECT_WITH_COMMENTS_ONLY = `${FINANCIAL_SELECT_BASE}, comments`;
const FINANCIAL_SELECT_WITH_COMMENTS_PASCAL_ONLY = `${FINANCIAL_SELECT_BASE}, Comments`;

const isMissingFinancialCommentsColumn = (error: { code?: string; message?: string } | null) => {
  if (!error) {
    return false;
  }

  if (error.code === '42703' || error.code === 'PGRST204') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return (
    (message.includes('comments') || message.includes('"comments"')) &&
    (message.includes('column') || message.includes('does not exist') || message.includes('could not find'))
  );
};

const isMissingFinancialReceiptUrlsColumn = (error: { code?: string; message?: string } | null) => {
  if (!error) {
    return false;
  }

  if (error.code === '42703' || error.code === 'PGRST204') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('receipt_urls') &&
    (message.includes('column') || message.includes('does not exist') || message.includes('could not find'))
  );
};

const isMissingFinancialReceiptColumn = (error: { code?: string; message?: string } | null) => {
  if (!error) {
    return false;
  }

  if (error.code === '42703' || error.code === 'PGRST204') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('receipt_url') &&
    (message.includes('column') || message.includes('does not exist') || message.includes('could not find'))
  );
};

const financialRowsQuery = (select: string, endDate: string) =>
  supabase
    .from('financials')
    .select(select)
    .in('budget_version', [
      FINANCIAL_BUDGET_VERSION_REALIZED,
      FINANCIAL_BUDGET_VERSION_PLANNED,
    ])
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: true });

const fetchFinancialRowsThroughDate = async (endDate: string) => {
  const viaRpc = await fetchFinancialRowsThroughDateViaRpc(endDate);

  if (viaRpc) {
    return viaRpc;
  }

  const withLowercase = await financialRowsQuery(FINANCIAL_SELECT_WITH_COMMENTS, endDate);

  if (!withLowercase.error) {
    return withLowercase;
  }

  if (isMissingFinancialReceiptUrlsColumn(withLowercase.error)) {
    const withoutReceiptUrls = await financialRowsQuery(
      FINANCIAL_SELECT_WITH_RECEIPT_URL_ONLY,
      endDate
    );

    if (!withoutReceiptUrls.error) {
      return withoutReceiptUrls;
    }

    if (!isMissingFinancialCommentsColumn(withoutReceiptUrls.error)) {
      return withoutReceiptUrls;
    }
  }

  if (isMissingFinancialReceiptColumn(withLowercase.error)) {
    const withoutReceipt = await financialRowsQuery(FINANCIAL_SELECT_WITH_COMMENTS_ONLY, endDate);

    if (!withoutReceipt.error) {
      return withoutReceipt;
    }

    if (!isMissingFinancialCommentsColumn(withoutReceipt.error)) {
      return withoutReceipt;
    }
  } else if (!isMissingFinancialCommentsColumn(withLowercase.error)) {
    return withLowercase;
  }

  const withPascal = await financialRowsQuery(FINANCIAL_SELECT_WITH_COMMENTS_PASCAL, endDate);

  if (!withPascal.error) {
    return withPascal;
  }

  if (isMissingFinancialReceiptUrlsColumn(withPascal.error)) {
    const withoutReceiptUrls = await financialRowsQuery(
      FINANCIAL_SELECT_WITH_RECEIPT_URL_ONLY_PASCAL,
      endDate
    );

    if (!withoutReceiptUrls.error) {
      return withoutReceiptUrls;
    }

    if (!isMissingFinancialCommentsColumn(withoutReceiptUrls.error)) {
      return withoutReceiptUrls;
    }
  }

  if (isMissingFinancialReceiptColumn(withPascal.error)) {
    const withoutReceipt = await financialRowsQuery(
      FINANCIAL_SELECT_WITH_COMMENTS_PASCAL_ONLY,
      endDate
    );

    if (!withoutReceipt.error) {
      return withoutReceipt;
    }

    if (!isMissingFinancialCommentsColumn(withoutReceipt.error)) {
      return withoutReceipt;
    }
  } else if (!isMissingFinancialCommentsColumn(withPascal.error)) {
    return withPascal;
  }

  return financialRowsQuery(FINANCIAL_SELECT_BASE, endDate);
};

const fetchCommentsByEntryIds = async (ids: string[]) => {
  const lowercase = await supabase.from('financials').select('id, comments').in('id', ids);

  if (!lowercase.error) {
    return lowercase;
  }

  if (!isMissingFinancialCommentsColumn(lowercase.error)) {
    return lowercase;
  }

  return supabase.from('financials').select('id, Comments').in('id', ids);
};

const fetchReceiptsByEntryIds = async (ids: string[]) => {
  const withUrls = await supabase
    .from('financials')
    .select('id, receipt_url, receipt_urls')
    .in('id', ids);

  if (!withUrls.error || !isMissingFinancialReceiptUrlsColumn(withUrls.error)) {
    return withUrls;
  }

  return supabase.from('financials').select('id, receipt_url').in('id', ids);
};

const FINANCIAL_COMMENTS_WARNING =
  'Alguns comentários financeiros não foram carregados. Os valores permanecem visíveis.';

const mergeEntryCommentsFromSupabase = async (
  entries: FinancialEntry[]
): Promise<{ entries: FinancialEntry[]; commentsWarning: string | null }> => {
  if (!entries.length) {
    return { entries, commentsWarning: null };
  }

  const ids = entries.map((entry) => entry.id);
  const [commentsResult, receiptsResult, expenseReportLinks] = await Promise.all([
    fetchCommentsByEntryIds(ids),
    fetchReceiptsByEntryIds(ids),
    fetchExpenseReportLinksForFinancialIds(ids),
  ]);
  const { data, error } = commentsResult;

  if (error) {
    if (isMissingFinancialCommentsColumn(error)) {
      return {
        entries: mergeExpenseReportLinksIntoFinancialEntries(
          mergeReceiptUrlsIntoEntries(entries, receiptsResult.data),
          expenseReportLinks
        ),
        commentsWarning: null,
      };
    }

    console.warn('Não foi possível carregar comments dos lançamentos:', error.message);
    return {
      entries: mergeExpenseReportLinksIntoFinancialEntries(
        mergeReceiptUrlsIntoEntries(entries, receiptsResult.data),
        expenseReportLinks
      ),
      commentsWarning: FINANCIAL_COMMENTS_WARNING,
    };
  }

  if (!data?.length) {
    return {
      entries: mergeExpenseReportLinksIntoFinancialEntries(
        mergeReceiptUrlsIntoEntries(entries, receiptsResult.data),
        expenseReportLinks
      ),
      commentsWarning: null,
    };
  }

  const commentsById = new Map<string, string>();

  for (const row of data) {
    const id = String((row as { id?: string }).id ?? '').trim();
    const comment = pickFinancialEntryComment(row as Record<string, unknown>);

    if (id && comment) {
      commentsById.set(id, comment);
    }
  }

  if (!commentsById.size) {
    return {
      entries: mergeExpenseReportLinksIntoFinancialEntries(
        mergeReceiptUrlsIntoEntries(entries, receiptsResult.data),
        expenseReportLinks
      ),
      commentsWarning: null,
    };
  }

  return {
    entries: mergeExpenseReportLinksIntoFinancialEntries(
      mergeReceiptUrlsIntoEntries(
        entries.map((entry) => {
          const extra = commentsById.get(entry.id);

          if (!extra) {
            return entry;
          }

          const merged =
            mergeFinancialComments(getFinancialEntryComment(entry) ?? undefined, extra) ?? extra;

          return { ...entry, comments: merged };
        }),
        receiptsResult.data
      ),
      expenseReportLinks
    ),
    commentsWarning: null,
  };
};

const mergeReceiptUrlsIntoEntries = (
  entries: FinancialEntry[],
  receiptRows: { id?: string; receipt_url?: string | null; receipt_urls?: unknown }[] | null | undefined
) => mergeFinancialReceiptUrlsIntoEntries(entries, receiptRows);

const readErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

type SessionFinancialMonthRow = {
  year?: number | string | null;
  month?: number | string | null;
  has_realized?: boolean | null;
  has_planned?: boolean | null;
};

const fetchFinancialMonthsFromSession = async (): Promise<{
  months: FinancialMonthKey[];
  plannedOnlyKeys: Set<string>;
} | null> => {
  const { data, error } = await supabase.rpc('listar_meses_financeiros_sessao');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_meses_financeiros_sessao')) {
      return null;
    }

    throw error;
  }

  const realizedKeys = new Set<string>();
  const plannedKeys = new Set<string>();

  for (const row of (data ?? []) as SessionFinancialMonthRow[]) {
    const year = Number(row.year);
    const month = Number(row.month);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      continue;
    }

    const key = formatFinancialMonthKey({ year, month });

    if (row.has_realized) {
      realizedKeys.add(key);
    }

    if (row.has_planned) {
      plannedKeys.add(key);
    }

    if (!row.has_realized && !row.has_planned) {
      realizedKeys.add(key);
    }
  }

  const months = filterSelectableFinancialMonths(
    mergeFinancialMonthLists(
      [...realizedKeys].map((key) => parseFinancialMonthKey(key)).filter((item): item is FinancialMonthKey => item !== null),
      [...plannedKeys].map((key) => parseFinancialMonthKey(key)).filter((item): item is FinancialMonthKey => item !== null)
    )
  );
  const plannedOnlyKeys = new Set(
    months
      .map((item) => formatFinancialMonthKey(item))
      .filter((key) => plannedKeys.has(key) && !realizedKeys.has(key))
  );

  return { months, plannedOnlyKeys };
};

const fetchFinancialRowsThroughDateViaRpc = async (endDate: string) => {
  const { data, error } = await supabase.rpc('listar_lancamentos_financeiros_ate', {
    p_end: endDate,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_lancamentos_financeiros_ate')) {
      return null;
    }

    throw error;
  }

  return { data, error: null };
};

type UseFinancialsByMonthResult = {
  loadingMonths: boolean;
  loadingEntries: boolean;
  errorMessage: string | null;
  commentsWarning: string | null;
  monthOptions: FinancialMonthKey[];
  plannedOnlyMonthKeys: ReadonlySet<string>;
  selectedMonth: FinancialMonthKey | null;
  setSelectedMonth: (month: FinancialMonthKey) => void;
  entries: FinancialEntry[];
  previousBalance: number;
  currentBalance: number;
  comparisonPreviousMonth: FinancialMonthKey | null;
  comparisonPreviousMonthEntries: FinancialEntry[];
  comparisonPreviousMonthOpeningBalance: number;
  comparisonPreviousMonthClosingBalance: number;
  budgetPlannedMonthEntries: FinancialEntry[];
  budgetPlannedOpeningBalance: number;
  budgetPlannedClosingBalance: number;
  realizedEntriesThroughSelectedMonth: FinancialEntry[];
  yearToDateRealizedBalance: number;
  reload: () => Promise<void>;
};

export function useFinancialsByMonth(): UseFinancialsByMonthResult {
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commentsWarning, setCommentsWarning] = useState<string | null>(null);
  const [monthOptions, setMonthOptions] = useState<FinancialMonthKey[]>([]);
  const [plannedOnlyMonthKeys, setPlannedOnlyMonthKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [selectedMonth, setSelectedMonth] = useState<FinancialMonthKey | null>(null);
  const selectedMonthRef = useRef<FinancialMonthKey | null>(null);
  selectedMonthRef.current = selectedMonth;
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [comparisonPreviousMonth, setComparisonPreviousMonth] =
    useState<FinancialMonthKey | null>(null);
  const [comparisonPreviousMonthEntries, setComparisonPreviousMonthEntries] = useState<
    FinancialEntry[]
  >([]);
  const [comparisonPreviousMonthOpeningBalance, setComparisonPreviousMonthOpeningBalance] =
    useState(0);
  const [comparisonPreviousMonthClosingBalance, setComparisonPreviousMonthClosingBalance] =
    useState(0);
  const [budgetPlannedMonthEntries, setBudgetPlannedMonthEntries] = useState<FinancialEntry[]>([]);
  const [budgetPlannedOpeningBalance, setBudgetPlannedOpeningBalance] = useState(0);
  const [budgetPlannedClosingBalance, setBudgetPlannedClosingBalance] = useState(0);
  const [realizedEntriesThroughSelectedMonth, setRealizedEntriesThroughSelectedMonth] = useState<
    FinancialEntry[]
  >([]);
  const [yearToDateRealizedBalance, setYearToDateRealizedBalance] = useState(0);

  const loadMonths = useCallback(async (): Promise<FinancialMonthKey | null> => {
    setLoadingMonths(true);
    setErrorMessage(null);

    try {
      const fromRpc = await fetchFinancialMonthsFromSession();
      let months: FinancialMonthKey[] = [];
      let plannedOnlyKeys = new Set<string>();

      if (fromRpc) {
        months = fromRpc.months;
        plannedOnlyKeys = fromRpc.plannedOnlyKeys;
      } else {
        const [realizedResult, plannedResult] = await Promise.all([
          supabase
            .from('financials')
            .select('transaction_date')
            .eq('budget_version', FINANCIAL_BUDGET_VERSION_REALIZED)
            .order('transaction_date', { ascending: false }),
          supabase
            .from('financials')
            .select('transaction_date')
            .eq('budget_version', FINANCIAL_BUDGET_VERSION_PLANNED)
            .order('transaction_date', { ascending: false }),
        ]);

        if (realizedResult.error) {
          throw realizedResult.error;
        }

        if (plannedResult.error) {
          throw plannedResult.error;
        }

        const realizedMonths = listFinancialMonthsFromDates(
          (realizedResult.data ?? []).map((row) => String(row.transaction_date))
        );
        const plannedMonths = listFinancialMonthsFromDates(
          (plannedResult.data ?? []).map((row) => String(row.transaction_date))
        );
        const allMonths = mergeFinancialMonthLists(realizedMonths, plannedMonths);
        months = filterSelectableFinancialMonths(allMonths);
        const realizedMonthKeys = new Set(
          realizedMonths.map((month) => formatFinancialMonthKey(month))
        );
        plannedOnlyKeys = new Set(
          months
            .map((month) => formatFinancialMonthKey(month))
            .filter((monthKey) => !realizedMonthKeys.has(monthKey))
        );
      }

      const currentMonth = selectedMonthRef.current;
      const nextMonth =
        currentMonth
        && isFinancialMonthBeforeCurrentCalendarMonth(currentMonth)
        && months.some(
          (month) => formatFinancialMonthKey(month) === formatFinancialMonthKey(currentMonth)
        )
          ? currentMonth
          : resolveDefaultFinancialMonth(months);

      setMonthOptions(months);
      setPlannedOnlyMonthKeys(plannedOnlyKeys);
      setSelectedMonth(nextMonth);
      return nextMonth;
    } catch (error) {
      console.error('Erro ao carregar meses financeiros:', error);
      setErrorMessage(readErrorMessage(error, 'Não foi possível carregar os meses disponíveis.'));
      setMonthOptions([]);
      setPlannedOnlyMonthKeys(new Set());
      setSelectedMonth(null);
      return null;
    } finally {
      setLoadingMonths(false);
    }
  }, []);

  const loadEntries = useCallback(async (month: FinancialMonthKey | null) => {
    if (!month) {
      setEntries([]);
      setPreviousBalance(0);
      setCurrentBalance(0);
      setComparisonPreviousMonth(null);
      setComparisonPreviousMonthEntries([]);
      setComparisonPreviousMonthOpeningBalance(0);
      setComparisonPreviousMonthClosingBalance(0);
      setBudgetPlannedMonthEntries([]);
      setBudgetPlannedOpeningBalance(0);
      setBudgetPlannedClosingBalance(0);
      setRealizedEntriesThroughSelectedMonth([]);
      setYearToDateRealizedBalance(0);
      setCommentsWarning(null);
      return;
    }

    setLoadingEntries(true);
    setErrorMessage(null);
    setCommentsWarning(null);

    const { startDate, endDate } = getFinancialMonthDateRange(month);

    try {
      const { data, error } = await fetchFinancialRowsThroughDate(endDate);

      if (error) {
        throw error;
      }

      const sourceRows: unknown[] = Array.isArray(data) ? data : [];
      const allRows = sourceRows
        .map((row) =>
          normalizeFinancialEntryRow(
            row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
          )
        )
        .filter((row): row is FinancialEntry => row !== null);
      const rows = filterRealizedFinancialEntries(allRows);
      const plannedRows = filterPlannedFinancialEntries(allRows);
      const { entries: monthEntries, commentsWarning: monthCommentsWarning } =
        await mergeEntryCommentsFromSupabase(
          rows.filter(
            (row) => row.transaction_date >= startDate && row.transaction_date <= endDate
          )
        );
      setCommentsWarning(monthCommentsWarning);
      const entriesBeforeMonth = rows.filter((row) => row.transaction_date < startDate);

      const priorMonth = getPreviousFinancialMonth(month);
      const priorMonthRange = getFinancialMonthDateRange(priorMonth);
      const priorMonthEntries = rows.filter(
        (row) =>
          row.transaction_date >= priorMonthRange.startDate &&
          row.transaction_date <= priorMonthRange.endDate
      );
      const entriesBeforePriorMonth = rows.filter(
        (row) => row.transaction_date < priorMonthRange.startDate
      );
      const priorMonthClosingRows = rows.filter(
        (row) => row.transaction_date <= priorMonthRange.endDate
      );

      setEntries(monthEntries);
      setRealizedEntriesThroughSelectedMonth(rows);
      setPreviousBalance(computeFinancialBalance(entriesBeforeMonth));
      setCurrentBalance(computeFinancialBalance(rows));
      setComparisonPreviousMonth(priorMonth);
      setComparisonPreviousMonthEntries(priorMonthEntries);
      setComparisonPreviousMonthOpeningBalance(computeFinancialBalance(entriesBeforePriorMonth));
      setComparisonPreviousMonthClosingBalance(computeFinancialBalance(priorMonthClosingRows));

      const plannedMonthEntries = plannedRows.filter(
        (row) => row.transaction_date >= startDate && row.transaction_date <= endDate
      );
      const plannedBeforeMonth = plannedRows.filter((row) => row.transaction_date < startDate);
      const plannedThroughMonth = plannedRows.filter((row) => row.transaction_date <= endDate);

      setBudgetPlannedMonthEntries(plannedMonthEntries);
      setBudgetPlannedOpeningBalance(computeFinancialBalance(plannedBeforeMonth));
      setBudgetPlannedClosingBalance(computeFinancialBalance(plannedThroughMonth));
      setYearToDateRealizedBalance(computeYearToDateRealizedMovement(rows, month));
    } catch (error) {
      console.error('Erro ao carregar lançamentos do mês:', error);
      setErrorMessage('Não foi possível carregar os lançamentos do mês selecionado.');
      setEntries([]);
      setPreviousBalance(0);
      setCurrentBalance(0);
      setComparisonPreviousMonth(null);
      setComparisonPreviousMonthEntries([]);
      setComparisonPreviousMonthOpeningBalance(0);
      setComparisonPreviousMonthClosingBalance(0);
      setBudgetPlannedMonthEntries([]);
      setBudgetPlannedOpeningBalance(0);
      setBudgetPlannedClosingBalance(0);
      setRealizedEntriesThroughSelectedMonth([]);
      setYearToDateRealizedBalance(0);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  const reload = useCallback(async () => {
    const month = await loadMonths();
    await loadEntries(month);
  }, [loadEntries, loadMonths]);

  useEffect(() => {
    void loadMonths();
  }, [loadMonths]);

  useEffect(() => {
    let previousGhostTarget = getGhostModeState()?.targetProfileId ?? null;

    const unsubscribeGhost = subscribeGhostMode(() => {
      const nextTarget = getGhostModeState()?.targetProfileId ?? null;
      if (nextTarget === previousGhostTarget) {
        return;
      }
      previousGhostTarget = nextTarget;
      void reload();
    });

    const unsubscribeTenant = subscribeActiveTenantChange(() => {
      void reload();
    });

    return () => {
      unsubscribeGhost();
      unsubscribeTenant();
    };
  }, [reload]);

  useEffect(() => {
    void loadEntries(selectedMonth);
  }, [loadEntries, selectedMonth]);

  return useMemo(
    () => ({
      loadingMonths,
      loadingEntries,
      errorMessage,
      commentsWarning,
      monthOptions,
      plannedOnlyMonthKeys,
      selectedMonth,
      setSelectedMonth,
      entries,
      previousBalance,
      currentBalance,
      comparisonPreviousMonth,
      comparisonPreviousMonthEntries,
      comparisonPreviousMonthOpeningBalance,
      comparisonPreviousMonthClosingBalance,
      budgetPlannedMonthEntries,
      budgetPlannedOpeningBalance,
      budgetPlannedClosingBalance,
      realizedEntriesThroughSelectedMonth,
      yearToDateRealizedBalance,
      reload,
    }),
    [
      realizedEntriesThroughSelectedMonth,
      yearToDateRealizedBalance,
      budgetPlannedClosingBalance,
      budgetPlannedMonthEntries,
      budgetPlannedOpeningBalance,
      comparisonPreviousMonth,
      comparisonPreviousMonthClosingBalance,
      comparisonPreviousMonthEntries,
      comparisonPreviousMonthOpeningBalance,
      currentBalance,
      entries,
      commentsWarning,
      errorMessage,
      loadingEntries,
      loadingMonths,
      monthOptions,
      plannedOnlyMonthKeys,
      previousBalance,
      reload,
      selectedMonth,
    ]
  );
}
