import { FinancialDescriptionValueTable } from '@/components/FinancialDescriptionValueTable';
import { FinancialMonthValueDetailModal } from '@/components/FinancialMonthValueDetailModal';
import { buildFinancialBulletin } from '@/lib/financialBulletin';
import {
  flattenBulletinRows,
  toSingleColumnComparisonRows,
  type BulletinComparisonRow,
} from '@/lib/financialBulletinComparison';
import { computeFinancialBalance, type FinancialEntry } from '@/lib/financialEntry';
import {
  formatFinancialMonthLabel,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import { FINANCIAL_MONTHLY_RESULT_BODY_MAX_HEIGHT } from '@/lib/financialReportTableLayout';
import {
  buildBulletinRowMonthlyValues,
  type FinancialRowMonthlyValue,
} from '@/lib/financialRowMonthlyDetail';
import { resolveActiveIgrejaBranding } from '@/lib/tenantSession';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
  const [detailTitle, setDetailTitle] = useState('');
  const [detailItems, setDetailItems] = useState<FinancialRowMonthlyValue[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

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
        flattenBulletinRows(bulletin).map((row) => {
          const label =
            row.key === 'saldo-anterior'
              ? 'Saldo inicial'
              : row.key === 'saldo-atual'
                ? 'Saldo atual'
                : row.label;

          return { ...row, label, comment: null };
        })
      ),
    [bulletin]
  );

  const handleRowPress = useCallback(
    (row: BulletinComparisonRow) => {
      setDetailTitle(row.label);
      setDetailVisible(true);
      setDetailLoading(true);
      setDetailItems([]);

      // Deixa o modal abrir e calcula a série fora do ciclo de gestos.
      requestAnimationFrame(() => {
        const items = buildBulletinRowMonthlyValues(row.key, endMonth, realizedEntries);
        setDetailItems(items);
        setDetailLoading(false);
      });
    },
    [endMonth, realizedEntries]
  );

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setDetailItems([]);
    setDetailLoading(false);
  }, []);

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
      <FinancialMonthValueDetailModal
        title={detailTitle}
        items={detailLoading ? [] : detailItems}
        visible={detailVisible}
        onClose={closeDetail}
        emptyMessage={
          detailLoading ? 'Carregando mês a mês…' : 'Sem meses com movimentação para esta conta.'
        }
      />

      <View style={styles.reportHeader}>
        <FontAwesome name="history" size={20} color="#0f172a" style={styles.reportIcon} />
        <View style={styles.reportHeaderText}>
          <Text style={styles.reportTitle}>RESULTADO HISTÓRICO</Text>
          <Text style={styles.reportPeriod}>{periodLabel}</Text>
          <Text style={styles.reportHint}>
            Realizado · toque em uma conta para ver mês a mês · saldo inicial e final até a
            referência
          </Text>
        </View>
      </View>

      {detailVisible && detailLoading ? (
        <ActivityIndicator color="#2563EB" style={styles.detailLoader} />
      ) : null}

      <View style={styles.tableHost}>
        <FinancialDescriptionValueTable
          rows={tableRows}
          maxBodyHeight={FINANCIAL_MONTHLY_RESULT_BODY_MAX_HEIGHT}
          onRowPress={handleRowPress}
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
  detailLoader: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    zIndex: 2,
  },
});
