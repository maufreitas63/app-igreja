import { FinancialComparisonTable } from '@/components/FinancialComparisonTable';
import { buildFinancialPlannedRealizedComparison } from '@/lib/financialBulletinComparison';
import type { FinancialEntry } from '@/lib/financialEntry';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { formatFinancialMonthLabel } from '@/lib/financialMonth';
import React, { useMemo } from 'react';

type FinancialMonthlyBudgetComparisonProps = {
  month: FinancialMonthKey;
  plannedMonthEntries: FinancialEntry[];
  plannedOpeningBalance: number;
  plannedClosingBalance: number;
  realizedMonthEntries: FinancialEntry[];
  realizedOpeningBalance: number;
  realizedClosingBalance: number;
};

export function FinancialMonthlyBudgetComparison({
  month,
  plannedMonthEntries,
  plannedOpeningBalance,
  plannedClosingBalance,
  realizedMonthEntries,
  realizedOpeningBalance,
  realizedClosingBalance,
}: FinancialMonthlyBudgetComparisonProps) {
  const comparison = useMemo(
    () =>
      buildFinancialPlannedRealizedComparison(
        month,
        {
          entries: plannedMonthEntries,
          previousBalance: plannedOpeningBalance,
          currentBalance: plannedClosingBalance,
        },
        {
          entries: realizedMonthEntries,
          previousBalance: realizedOpeningBalance,
          currentBalance: realizedClosingBalance,
        }
      ),
    [
      month,
      plannedClosingBalance,
      plannedMonthEntries,
      plannedOpeningBalance,
      realizedClosingBalance,
      realizedMonthEntries,
      realizedOpeningBalance,
    ]
  );

  const monthLabel = formatFinancialMonthLabel(month);

  return (
    <FinancialComparisonTable
      title="PLANEJADO × REALIZADO"
      periodLabel={monthLabel}
      hint="Mês selecionado · variação = realizado − planejado"
      leftColumnHeader="Planejado"
      rightColumnHeader="Realizado"
      rows={comparison.rows}
      emptyMessage="Sem dados de orçamento para este mês."
      icon="balance-scale"
    />
  );
}
