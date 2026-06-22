import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import {
  buildMemberGrowthSeriesThroughMonth,
  findEarliestMembershipMonth,
  type MembershipDateRecord,
} from '@/lib/memberGrowthSeries';
import {
  FINANCIAL_BUDGET_VERSION_PLANNED,
  FINANCIAL_BUDGET_VERSION_REALIZED,
  normalizeFinancialEntryRow,
  type FinancialEntry,
} from '@/lib/financialEntry';
import {
  compareFinancialMonthKeys,
  formatFinancialMonthKey,
  getCalendarMonthKey,
  getFinancialMonthDateRange,
  parseFinancialMonthFromDate,
} from '@/lib/financialMonth';
import { countPositiveRevenueMonths } from '@/lib/financialPredictiveModel';
import { sumOrdinaryTithesOfferingsRevenue } from '@/lib/ordinaryTithesOfferingsRevenue';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PREDICTIVE_INSIGHTS_SQL_HINT =
  'Execute no Supabase: scripts/access-control-predictive-insights.sql';

const FINANCIAL_SELECT =
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version';

const FINANCIAL_PAGE_SIZE = 1000;

const fetchFinancialRowsThroughDate = async (endDate: string) => {
  const rows: FinancialEntry[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('financials')
      .select(FINANCIAL_SELECT)
      .in('budget_version', [FINANCIAL_BUDGET_VERSION_REALIZED, FINANCIAL_BUDGET_VERSION_PLANNED])
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true })
      .range(from, from + FINANCIAL_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data ?? []).map((row) => normalizeFinancialEntryRow(row));
    rows.push(...page);

    if (page.length < FINANCIAL_PAGE_SIZE) {
      break;
    }

    from += FINANCIAL_PAGE_SIZE;
  }

  return rows;
};

const buildRevenueTotalsByMonth = (financialEntries: FinancialEntry[]) => {
  const revenueByMonth = new Map<string, FinancialEntry[]>();

  for (const entry of financialEntries) {
    const month = parseFinancialMonthFromDate(entry.transaction_date);

    if (!month) {
      continue;
    }

    const monthKey = formatFinancialMonthKey(month);
    const bucket = revenueByMonth.get(monthKey) ?? [];
    bucket.push(entry);
    revenueByMonth.set(monthKey, bucket);
  }

  const revenueTotalsByMonth = new Map<string, number>();

  for (const [monthKey, bucket] of revenueByMonth.entries()) {
    revenueTotalsByMonth.set(monthKey, sumOrdinaryTithesOfferingsRevenue(bucket));
  }

  return revenueTotalsByMonth;
};

const fetchOrdinaryRevenueViaRpc = async (actorProfileId: string, endDate: string) => {
  const { data, error } = await supabase.rpc('listar_receita_ordinaria_modelo_preditivo', {
    p_actor_profile_id: actorProfileId,
    p_end_date: endDate,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_receita_ordinaria_modelo_preditivo')) {
      return null;
    }

    throw error;
  }

  return (data ?? []).map((row) => normalizeFinancialEntryRow(row));
};

const fetchOrdinaryRevenueEntriesForPredictiveModel = async (endDate: string) => {
  const actorProfileId = await resolveActorProfileId();
  let rpcRows: FinancialEntry[] | null = null;

  if (actorProfileId) {
    rpcRows = await fetchOrdinaryRevenueViaRpc(actorProfileId, endDate);
  }

  let directRows: FinancialEntry[] | null = null;

  try {
    directRows = await fetchFinancialRowsThroughDate(endDate);
  } catch (financialError) {
    if (rpcRows) {
      return rpcRows;
    }

    throw financialError;
  }

  if (!rpcRows) {
    return directRows;
  }

  const rpcRevenueMonths = countPositiveRevenueMonths(buildRevenueTotalsByMonth(rpcRows));
  const directRevenueMonths = countPositiveRevenueMonths(buildRevenueTotalsByMonth(directRows));

  return rpcRevenueMonths >= directRevenueMonths ? rpcRows : directRows;
};

const parseMembershipRecords = (data: unknown): MembershipDateRecord[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;

      return {
        membershipDate: record.membership_date
          ? String(record.membership_date).trim() || null
          : record.membershipDate
            ? String(record.membershipDate).trim() || null
            : null,
        membershipOut: record.membership_out
          ? String(record.membership_out).trim() || null
          : record.membershipOut
            ? String(record.membershipOut).trim() || null
            : null,
      } satisfies MembershipDateRecord;
    })
    .filter((record) => record.membershipDate || record.membershipOut);
};

export async function sessionCanAccessPredictiveInsightsPanel() {
  const profileId = await resolveActorProfileId();

  if (!profileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('profile_has_access', {
    p_profile_id: profileId,
    p_resource_type: 'screen',
    p_resource_key: 'maintenance.card.predictive_insights',
    p_action: 'view',
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'profile_has_access')) {
      return false;
    }

    throw error;
  }

  return data === true;
}

export async function fetchMembershipDatesForPredictiveModel() {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_datas_membresia_modelo_preditivo', {
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_datas_membresia_modelo_preditivo')) {
      throw new Error(PREDICTIVE_INSIGHTS_SQL_HINT);
    }

    throw error;
  }

  return parseMembershipRecords(data);
}

export async function fetchPredictiveInsightsSourceData() {
  const endMonth = getCalendarMonthKey();
  const { endDate } = getFinancialMonthDateRange(endMonth);
  const membershipRecords = await fetchMembershipDatesForPredictiveModel();
  const financialEntries = await fetchOrdinaryRevenueEntriesForPredictiveModel(endDate);
  const revenueTotalsByMonth = buildRevenueTotalsByMonth(financialEntries);

  const earliestMembershipMonth = findEarliestMembershipMonth(membershipRecords);
  const startMonth =
    earliestMembershipMonth && compareFinancialMonthKeys(earliestMembershipMonth, endMonth) <= 0
      ? earliestMembershipMonth
      : endMonth;

  const memberSeries = buildMemberGrowthSeriesThroughMonth(
    membershipRecords,
    startMonth,
    endMonth
  );

  return {
    revenueByMonth: revenueTotalsByMonth,
    memberSeries,
    endMonth,
    revenueMonthCount: countPositiveRevenueMonths(revenueTotalsByMonth),
    financialEntryCount: financialEntries.length,
  };
}
