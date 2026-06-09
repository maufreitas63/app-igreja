import { FinancialDescriptionValueTable } from '@/components/FinancialDescriptionValueTable';
import { buildFinancialBulletin } from '@/lib/financialBulletin';
import { buildMonthlyBulletinTableRows } from '@/lib/financialBulletinComparison';
import type { FinancialEntry } from '@/lib/financialEntry';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { FINANCIAL_MONTHLY_RESULT_BODY_MAX_HEIGHT } from '@/lib/financialReportTableLayout';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type FinancialMonthlyBulletinProps = {
  entries: FinancialEntry[];
  month: FinancialMonthKey;
  previousBalance: number;
  currentBalance: number;
  yearToDateRealizedBalance?: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinancialMonthlyBulletin({
  entries,
  month,
  previousBalance,
  currentBalance,
  yearToDateRealizedBalance,
}: FinancialMonthlyBulletinProps) {
  const bulletin = useMemo(
    () =>
      buildFinancialBulletin(entries, month, {
        previousBalance,
        currentBalance,
      }),
    [currentBalance, entries, month, previousBalance]
  );

  const tableRows = useMemo(
    () => buildMonthlyBulletinTableRows(bulletin, entries),
    [bulletin, entries]
  );

  const hasAnyData =
    entries.length > 0 ||
    Math.abs(bulletin.previousBalance) > 0.009 ||
    Math.abs(bulletin.currentBalance) > 0.009;

  if (!hasAnyData) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.emptyText}>Nenhum lançamento para exibir neste mês.</Text>
      </View>
    );
  }

  const periodLabel = `${bulletin.organizationName} · ${bulletin.periodLabel}`;

  return (
    <View style={styles.sheet}>
      <View style={styles.reportHeader}>
        <FontAwesome name="university" size={20} color="#0f172a" style={styles.reportIcon} />
        <View style={styles.reportHeaderText}>
          <Text style={styles.reportTitle}>BOLETIM FINANCEIRO MENSAL</Text>
          <Text style={styles.reportPeriod}>{periodLabel}</Text>
          <Text style={styles.reportHint}>
            Realizado apenas · entradas, saídas e entre contas
            {typeof yearToDateRealizedBalance === 'number'
              ? ` · YTD movimento ${month.year}: ${formatCurrency(yearToDateRealizedBalance)}`
              : ''}
          </Text>
        </View>
      </View>

      <View style={styles.tableHost}>
        <FinancialDescriptionValueTable
          rows={tableRows}
          entries={entries}
          showCommentIcons
          maxBodyHeight={FINANCIAL_MONTHLY_RESULT_BODY_MAX_HEIGHT}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    gap: 10,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  tableHost: {
    flexShrink: 1,
    overflow: 'hidden',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reportIcon: {
    marginTop: 2,
  },
  reportHeaderText: {
    flex: 1,
    gap: 2,
  },
  reportTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  reportPeriod: {
    color: '#64748B',
    fontSize: 13,
  },
  reportHint: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
