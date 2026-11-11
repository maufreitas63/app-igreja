import {
  FINANCIAL_BUDGET_VERSION_PLANNED,
  FINANCIAL_BUDGET_VERSION_REALIZED,
} from '@/lib/financialEntry';
import { supabase } from '@/lib/supabase';

/** PostgREST corta em 1000 linhas; relatórios precisam percorrer todas as páginas. */
export const FINANCIALS_FETCH_PAGE_SIZE = 1000;

type FinancialsPageResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

/** Lançamentos realizados e previstos até a data, na ordem já usada pelas telas. */
export function financialsThroughDateQuery(select: string, endDate: string) {
  return supabase
    .from('financials')
    .select(select)
    .in('budget_version', [FINANCIAL_BUDGET_VERSION_REALIZED, FINANCIAL_BUDGET_VERSION_PLANNED])
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: true })
    .order('id', { ascending: true });
}

/** Junta páginas de 1000 até acabar o conjunto (RPC ou tabela). */
export async function fetchAllPagedFinancialRows(
  fetchPage: (from: number, to: number) => PromiseLike<FinancialsPageResult>
): Promise<{ data: unknown[]; error: null } | { data: null; error: NonNullable<FinancialsPageResult['error']> }> {
  const rows: unknown[] = [];
  let from = 0;

  while (true) {
    const to = from + FINANCIALS_FETCH_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      return { data: null, error };
    }

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);

    if (page.length < FINANCIALS_FETCH_PAGE_SIZE) {
      return { data: rows, error: null };
    }

    from += FINANCIALS_FETCH_PAGE_SIZE;
  }
}
