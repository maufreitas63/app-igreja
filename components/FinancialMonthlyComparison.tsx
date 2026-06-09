import { FinancialComparisonTable } from '@/components/FinancialComparisonTable';
import { buildFinancialBulletinComparison } from '@/lib/financialBulletinComparison';
import type { FinancialEntry } from '@/lib/financialEntry';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { formatFinancialMonthShortLabel } from '@/lib/financialMonth';
import React, { useMemo } from 'react';

type FinancialMonthlyComparisonProps = {
  currentMonth: FinancialMonthKey;
  currentMonthEntries: FinancialEntry[];
  currentMonthPreviousBalance: number;
  currentMonthCurrentBalance: number;
  previousMonth: FinancialMonthKey;
  previousMonthEntries: FinancialEntry[];
  previousMonthPreviousBalance: number;
  previousMonthCurrentBalance: number;
};

export function FinancialMonthlyComparison({
  currentMonth,
  currentMonthEntries,
  currentMonthPreviousBalance,
  currentMonthCurrentBalance,
  previousMonth,
  previousMonthEntries,
  previousMonthPreviousBalance,
  previousMonthCurrentBalance,
}: FinancialMonthlyComparisonProps) {
  const comparison = useMemo(
    () =>
      buildFinancialBulletinComparison(
        {
          month: previousMonth,
          entries: previousMonthEntries,
          previousBalance: previousMonthPreviousBalance,
          currentBalance: previousMonthCurrentBalance,
        },
        {
          month: currentMonth,
          entries: currentMonthEntries,
          previousBalance: currentMonthPreviousBalance,
          currentBalance: currentMonthCurrentBalance,
        }
      ),
    [
      currentMonth,
      currentMonthCurrentBalance,
      currentMonthEntries,
      currentMonthPreviousBalance,
      previousMonth,
      previousMonthCurrentBalance,
      previousMonthEntries,
      previousMonthPreviousBalance,
    ]
  );

  const previousHeader = formatFinancialMonthShortLabel(previousMonth);
  const currentHeader = formatFinancialMonthShortLabel(currentMonth);

  return (
    <FinancialComparisonTable
      title="COMPARATIVO MENSAL"
      periodLabel={`${previousHeader} × ${currentHeader}`}
      hint="Realizado · variação = mês atual − mês anterior"
      leftColumnHeader={previousHeader}
      rightColumnHeader={currentHeader}
      rows={comparison.rows}
      emptyMessage="Sem dados para comparar entre os meses."
    />
  );
}
