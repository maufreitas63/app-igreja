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
  filterSelectableFinancialMonths,
  formatFinancialMonthKey,
  getFinancialMonthDateRange,
  getPreviousFinancialMonth,
  isFinancialMonthBeforeCurrentCalendarMonth,
  listFinancialMonthsFromDates,
  mergeFinancialMonthLists,
  resolveDefaultFinancialMonth,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type { FinancialEntry } from '@/lib/financialEntry';

const FINANCIAL_SELECT_BASE =
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version';

const FINANCIAL_SELECT_WITH_COMMENTS = `${FINANCIAL_SELECT_BASE}, comments, receipt_url`;
const FINANCIAL_SELECT_WITH_COMMENTS_PASCAL = `${FINANCIAL_SELECT_BASE}, Comments, receipt_url`;
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
  const withLowercase = await financialRowsQuery(FINANCIAL_SELECT_WITH_COMMENTS, endDate);

  if (!withLowercase.error) {
    return withLowercase;
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

const FINANCIAL_COMMENTS_WARNING =
  'Alguns comentários financeiros não foram carregados. Os valores permanecem visíveis.';

const mergeEntryCommentsFromSupabase = async (
  entries: FinancialEntry[]
): Promise<{ entries: FinancialEntry[]; commentsWarning: string | null }> => {
  if (!entries.length) {
    return { entries, commentsWarning: null };
  }

  const ids = entries.map((entry) => entry.id);
  const { data, error } = await fetchCommentsByEntryIds(ids);

  if (error) {
    if (isMissingFinancialCommentsColumn(error)) {
      return { entries, commentsWarning: null };
    }

    console.warn('Não foi possível carregar comments dos lançamentos:', error.message);
    return { entries, commentsWarning: FINANCIAL_COMMENTS_WARNING };
  }

  if (!data?.length) {
    return { entries, commentsWarning: null };
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
    return { entries, commentsWarning: null };
  }

  return {
    entries: entries.map((entry) => {
      const extra = commentsById.get(entry.id);

      if (!extra) {
        return entry;
      }

      const merged =
        mergeFinancialComments(getFinancialEntryComment(entry) ?? undefined, extra) ?? extra;

      return { ...entry, comments: merged };
    }),
    commentsWarning: null,
  };
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

  const loadMonths = useCallback(async () => {
    setLoadingMonths(true);
    setErrorMessage(null);

    try {
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
      const months = filterSelectableFinancialMonths(allMonths);
      const realizedMonthKeys = new Set(
        realizedMonths.map((month) => formatFinancialMonthKey(month))
      );
      const plannedOnlyKeys = new Set(
        months
          .map((month) => formatFinancialMonthKey(month))
          .filter((monthKey) => !realizedMonthKeys.has(monthKey))
      );

      setMonthOptions(months);
      setPlannedOnlyMonthKeys(plannedOnlyKeys);
      setSelectedMonth((current) => {
        if (
          current &&
          isFinancialMonthBeforeCurrentCalendarMonth(current) &&
          months.some((month) => formatFinancialMonthKey(month) === formatFinancialMonthKey(current))
        ) {
          return current;
        }

        return resolveDefaultFinancialMonth(months);
      });
    } catch (error) {
      console.error('Erro ao carregar meses financeiros:', error);
      setErrorMessage('Não foi possível carregar os meses disponíveis.');
      setMonthOptions([]);
      setPlannedOnlyMonthKeys(new Set());
      setSelectedMonth(null);
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

      const allRows = (data ?? [])
        .map((row) => normalizeFinancialEntryRow(row as Record<string, unknown>))
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
    await loadMonths();
    await loadEntries(selectedMonth);
  }, [loadEntries, loadMonths, selectedMonth]);

  useEffect(() => {
    void loadMonths();
  }, [loadMonths]);

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
