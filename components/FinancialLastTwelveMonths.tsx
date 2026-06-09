import { FinancialMultiMonthTable } from '@/components/FinancialMultiMonthTable';
import type { FinancialEntry } from '@/lib/financialEntry';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import {
  buildFinancialTwelveMonthMatrix,
  formatTwelveMonthPeriodLabel,
} from '@/lib/financialTwelveMonthMatrix';
import React, { useMemo } from 'react';

type FinancialLastTwelveMonthsProps = {
  endMonth: FinancialMonthKey;
  realizedEntries: FinancialEntry[];
};

export function FinancialLastTwelveMonths({
  endMonth,
  realizedEntries,
}: FinancialLastTwelveMonthsProps) {
  const matrix = useMemo(
    () => buildFinancialTwelveMonthMatrix(endMonth, realizedEntries),
    [endMonth, realizedEntries]
  );

  const periodLabel = formatTwelveMonthPeriodLabel(matrix.columns);

  return (
    <FinancialMultiMonthTable
      title="ÚLTIMOS 12 MESES"
      periodLabel={periodLabel}
      hint="Realizado · uma coluna por mês (período terminando no mês selecionado)"
      matrix={matrix}
      emptyMessage="Sem lançamentos realizados no período."
      icon="calendar"
    />
  );
}
