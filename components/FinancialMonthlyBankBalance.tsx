import { formatBulletinAmount } from '@/lib/financialBulletin';
import { computeFinancialAccountClosingBalances } from '@/lib/financialAccountBalance';
import type { FinancialEntry } from '@/lib/financialEntry';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { formatFinancialMonthLabel } from '@/lib/financialMonth';
import { financialReportTableFrameStyle } from '@/lib/financialReportTableLayout';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type FinancialMonthlyBankBalanceProps = {
  month: FinancialMonthKey;
  realizedEntriesThroughMonth: FinancialEntry[];
};

export function FinancialMonthlyBankBalance({
  month,
  realizedEntriesThroughMonth,
}: FinancialMonthlyBankBalanceProps) {
  const rows = useMemo(
    () => computeFinancialAccountClosingBalances(realizedEntriesThroughMonth),
    [realizedEntriesThroughMonth]
  );

  const totalBalance = useMemo(
    () => rows.reduce((sum, row) => sum + row.balance, 0),
    [rows]
  );

  const monthLabel = formatFinancialMonthLabel(month);

  if (!rows.length) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.emptyText}>Sem saldo bancário para exibir neste mês.</Text>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.reportHeader}>
        <FontAwesome name="bank" size={18} color="#0f172a" style={styles.reportIcon} />
        <View style={styles.reportHeaderText}>
          <Text style={styles.reportTitle}>SALDO BANCÁRIO</Text>
          <Text style={styles.reportPeriod}>{monthLabel}</Text>
          <Text style={styles.reportHint}>Saldo final por conta · realizado acumulado</Text>
        </View>
      </View>

      <View style={styles.tableFrame}>
        <View style={styles.tableHeaderRow}>
          <View style={styles.accountHeaderCell}>
            <Text style={styles.headerLabel}>Conta</Text>
          </View>
          <View style={styles.valueHeaderCell}>
            <Text style={styles.headerValue}>Valor</Text>
          </View>
        </View>

        {rows.map((row) => {
          const negative = row.balance < 0;

          return (
            <View key={row.accountLabel} style={styles.dataRow}>
              <View style={styles.accountBodyCell}>
                <Text style={styles.accountLabel} numberOfLines={2}>
                  {row.accountLabel}
                </Text>
              </View>
              <View style={styles.valueBodyCell}>
                <Text
                  style={[
                    styles.valueCell,
                    negative ? styles.valueNegative : styles.valuePositive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {formatBulletinAmount(row.balance)}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={styles.totalRow}>
          <View style={styles.accountBodyCell}>
            <Text style={styles.totalLabel}>Saldo total</Text>
          </View>
          <View style={styles.valueBodyCell}>
            <Text
              style={[
                styles.valueCell,
                styles.totalValue,
                totalBalance < 0 ? styles.valueNegative : styles.valuePositive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {formatBulletinAmount(totalBalance)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 2,
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
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  reportPeriod: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  reportHint: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
  },
  tableFrame: {
    ...financialReportTableFrameStyle,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  accountHeaderCell: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  valueHeaderCell: {
    width: 120,
    flexShrink: 0,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerValue: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  accountBodyCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    justifyContent: 'center',
  },
  accountLabel: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  valueBodyCell: {
    width: 120,
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  valueCell: {
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  valuePositive: {
    color: '#0F172A',
  },
  valueNegative: {
    color: '#DC2626',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderTopWidth: 2,
    borderTopColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  totalLabel: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  totalValue: {
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
