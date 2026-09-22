import {
  FINANCIAL_BUDGET_VERSION_PLANNED,
  FINANCIAL_BUDGET_VERSION_REALIZED,
} from '@/lib/financialEntry';
import { supabase } from '@/lib/supabase';

/** Lançamentos realizados e previstos até a data, na ordem já usada pelas telas. */
export function financialsThroughDateQuery(select: string, endDate: string) {
  return supabase
    .from('financials')
    .select(select)
    .in('budget_version', [FINANCIAL_BUDGET_VERSION_REALIZED, FINANCIAL_BUDGET_VERSION_PLANNED])
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: true });
}
