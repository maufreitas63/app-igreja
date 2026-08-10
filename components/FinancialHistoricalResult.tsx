import { FinancialDescriptionValueTable } from '@/components/FinancialDescriptionValueTable';
import { buildFinancialBulletin } from '@/lib/financialBulletin';
import {
  flattenBulletinRows,
  toSingleColumnComparisonRows,
} from '@/lib/financialBulletinComparison';
import { computeFinancialBalance, type FinancialEntry } from '@/lib/financialEntry';
import {
  formatFinancialMonthLabel,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import { FINANCIAL_MONTHLY_RESULT_BODY_MAX_HEIGHT } from '@/lib/financialReportTableLayout';
import { resolveActiveIgrejaBranding } from '@/lib/tenantSession';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type FinancialHistoricalResultProps = {
  endMonth: FinancialMonthKey;
  /** Todos os lançamentos REALIZADOS do início das operações até o fim do mês de referência. */
  realizedEntries: FinancialEntry[];
  /** Saldo atual no mês de referência (deve fechar igual ao saldo acumulado histórico). */
  currentBalance: number;
};

export function FinancialHistoricalResult({
  endMonth,
  realizedEntries,
  currentBalance,
}: FinancialHistoricalResultProps) {
  const [organizationName, setOrganizationName] = useState('Igreja');

  useEffect(() => {
    let active = true;
    void resolveActiveIgrejaBranding().then((branding) => {
      if (active && branding?.name?.trim()) {
        setOrganizationName(branding.name.trim());
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const closingBalance = useMemo(() => {
    const recomputed = computeFinancialBalance(realizedEntries);
    // Preferir o saldo do mês de referência quando a diferença for só de arredondamento.
    if (Math.abs(recomputed - currentBalance) < 0.02) {
      return currentBalance;
    }
    return recomputed;
  }, [currentBalance, realizedEntries]);

  const bulletin = useMemo(() => {
    const built = buildFinancialBulletin(
      realizedEntries,
      endMonth,
      {
        previousBalance: 0,
        currentBalance: closingBalance,
      },
      organizationName
    );

    return {
      ...built,
      periodLabel: `Início das operações · até ${formatFinancialMonthLabel(endMonth)}`,
    };
  }, [closingBalance, endMonth, organizationName, realizedEntries]);

  const tableRows = useMemo(
    () =>
      toSingleColumnComparisonRows(
        flattenBulletinRows(bulletin).map((row) => ({ ...row, comment: null }))
      ),
    [bulletin]
  );

  const hasAnyData =
    realizedEntries.length > 0 || Math.abs(closingBalance) > 0.009;

  if (!hasAnyData) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.emptyText}>
          Nenhum lançamento realizado desde o início das operações até este mês.
        </Text>
      </View>
    );
  }

  const periodLabel = `${bulletin.organizationName} · ${bulletin.periodLabel}`;

  return (
    <View style={styles.sheet}>
      <View style={styles.reportHeader}>
        <FontAwesome name="history" size={20} color="#0f172a" style={styles.reportIcon} />
        <View style={styles.reportHeaderText}>
          <Text style={styles.reportTitle}>RESULTADO HISTÓRICO</Text>
          <Text style={styles.reportPeriod}>{periodLabel}</Text>
          <Text style={styles.reportHint}>
            Realizado · todas as movimentações · saldo inicial e saldo final até o mês de
            referência
          </Text>
        </View>
      </View>

      <View style={styles.tableHost}>
        <FinancialDescriptionValueTable
          rows={tableRows}
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
