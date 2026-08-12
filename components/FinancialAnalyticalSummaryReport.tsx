import {
  buildFinancialAnalyticalSummaryReport,
  type AnalyticalAccountRow,
  type AnalyticalPeriodColumn,
  type FinancialAnalyticalSummaryReport,
} from '@/lib/financialAnalyticalSummaryReport';
import { formatFinancialBrl, formatFinancialMonthLabel, type FinancialMonthKey } from '@/lib/financialMonth';
import type { FinancialEntry } from '@/lib/financialEntry';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type FinancialAnalyticalSummaryReportViewProps = {
  endMonth: FinancialMonthKey;
  realizedEntries: FinancialEntry[];
};

const AmountCell = ({
  value,
  highlighted,
  bold,
}: {
  value: number;
  highlighted?: boolean;
  bold?: boolean;
}) => {
  const negative = value < -0.005;

  return (
    <Text
      style={[
        styles.amount,
        highlighted && styles.amountHighlighted,
        bold && styles.amountBold,
        negative && styles.amountNegative,
      ]}
      numberOfLines={1}
    >
      {formatFinancialBrl(value)}
    </Text>
  );
};

function PeriodTable({ columns }: { columns: AnalyticalPeriodColumn[] }) {
  const rows: { label: string; key: 'ordinario' | 'extraordinario' | 'total'; bold?: boolean }[] = [
    { label: 'Ordinário', key: 'ordinario' },
    { label: 'Extraordinário', key: 'extraordinario' },
    { label: 'Resultado total', key: 'total', bold: true },
  ];

  return (
    <View style={styles.tableCard}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.headerCell, styles.periodLabelCol, styles.headerCellLeft]}>Período</Text>
        {columns.map((column) => (
          <Text
            key={`${column.month.year}-${column.month.month}`}
            style={[
              styles.headerCell,
              styles.periodValueCol,
              column.isFocus && styles.headerCellFocus,
            ]}
          >
            {column.header}
          </Text>
        ))}
      </View>

      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt, row.bold && styles.totalRow]}
        >
          <Text style={[styles.labelCell, styles.periodLabelCol, row.bold && styles.labelBold]}>
            {row.label}
          </Text>
          {columns.map((column) => (
            <View
              key={`${row.key}-${column.month.year}-${column.month.month}`}
              style={[styles.periodValueCol, column.isFocus && styles.cellFocus]}
            >
              <AmountCell value={column[row.key]} highlighted={column.isFocus} bold={row.bold} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function MovementsTable({
  rows,
  totals,
}: {
  rows: AnalyticalAccountRow[];
  totals: FinancialAnalyticalSummaryReport['monthTotals'];
}) {
  return (
    <View style={styles.tableCard}>
      <View style={styles.sectionBanner}>
        <Text style={styles.sectionBannerText}>MOVIMENTOS DO MÊS</Text>
      </View>

      <View style={[styles.tableRow, styles.subHeaderRow]}>
        <Text style={[styles.subHeaderCell, styles.accountCol, styles.subHeaderLeft]}>Conta</Text>
        <Text style={[styles.subHeaderCell, styles.valueCol]}>Movimentos Ordinários</Text>
        <Text style={[styles.subHeaderCell, styles.valueCol]}>Movimentos Extraordinários</Text>
        <Text style={[styles.subHeaderCell, styles.valueCol]}>Total</Text>
      </View>

      {rows.map((row, index) => (
        <View key={row.account} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
          <Text style={[styles.labelCell, styles.accountCol]} numberOfLines={2}>
            {row.account}
          </Text>
          <View style={styles.valueCol}>
            <AmountCell value={row.ordinario} />
          </View>
          <View style={styles.valueCol}>
            <AmountCell value={row.extraordinario} />
          </View>
          <View style={styles.valueCol}>
            <AmountCell value={row.total} bold />
          </View>
        </View>
      ))}

      <View style={[styles.tableRow, styles.totalRow, styles.totalRowFocus]}>
        <Text style={[styles.labelCell, styles.accountCol, styles.labelBold]}>TOTAL</Text>
        <View style={styles.valueCol}>
          <AmountCell value={totals.ordinario} bold highlighted />
        </View>
        <View style={styles.valueCol}>
          <AmountCell value={totals.extraordinario} bold highlighted />
        </View>
        <View style={styles.valueCol}>
          <AmountCell value={totals.total} bold highlighted />
        </View>
      </View>
    </View>
  );
}

function HistoricalTable({
  historical,
}: {
  historical: FinancialAnalyticalSummaryReport['historical'];
}) {
  return (
    <View style={styles.tableCard}>
      <View style={styles.sectionBanner}>
        <Text style={styles.sectionBannerText}>ACUMULADO HISTÓRICO</Text>
      </View>

      <View style={styles.tableRow}>
        <Text style={[styles.labelCell, styles.histLabelCol]}>Ordinário</Text>
        <View style={styles.histValueCol}>
          <AmountCell value={historical.ordinario} />
        </View>
      </View>
      <View style={[styles.tableRow, styles.tableRowAlt]}>
        <Text style={[styles.labelCell, styles.histLabelCol]}>Extraordinário</Text>
        <View style={styles.histValueCol}>
          <AmountCell value={historical.extraordinario} />
        </View>
      </View>
      <View style={[styles.tableRow, styles.totalRow]}>
        <Text style={[styles.labelCell, styles.histLabelCol, styles.labelBold]}>Saldo acumulado</Text>
        <View style={styles.histValueCol}>
          <AmountCell value={historical.saldo} bold />
        </View>
      </View>
    </View>
  );
}

export function FinancialAnalyticalSummaryReportView({
  endMonth,
  realizedEntries,
}: FinancialAnalyticalSummaryReportViewProps) {
  const report = useMemo(
    () => buildFinancialAnalyticalSummaryReport(endMonth, realizedEntries),
    [endMonth, realizedEntries]
  );

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      contentContainerStyle={styles.reportScrollContent}
    >
      <View style={styles.reportRoot}>
        <View style={styles.reportTitleBar}>
          <Text style={styles.reportTitle}>RELATÓRIO ANALÍTICO — RESUMO FINANCEIRO</Text>
        </View>

        <PeriodTable columns={report.periodColumns} />
        <MovementsTable rows={report.accountRows} totals={report.monthTotals} />
        <HistoricalTable historical={report.historical} />
      </View>
    </ScrollView>
  );
}

type FinancialAnalyticalSummarySectionProps = {
  month: FinancialMonthKey | null;
  realizedEntries: FinancialEntry[];
  loading?: boolean;
  expanded: boolean;
  onToggle: () => void;
};

/** Seção expansível no hub financeiro (substitui o viewer de JPG). */
export function FinancialAnalyticalSummarySection({
  month,
  realizedEntries,
  loading = false,
  expanded,
  onToggle,
}: FinancialAnalyticalSummarySectionProps) {
  return (
    <View style={styles.section}>
      <TouchableOpacity
        accessibilityLabel="Relatório Analítico / Resumo Financeiro"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        activeOpacity={0.85}
        onPress={onToggle}
        style={styles.sectionHeader}
        disabled={!month}
      >
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionLabel}>Relatório Analítico / Resumo Financeiro</Text>
          {month ? (
            <Text style={styles.sectionMeta}>{formatFinancialMonthLabel(month)}</Text>
          ) : (
            <Text style={styles.sectionMeta}>Selecione o mês de referência</Text>
          )}
        </View>
        <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.sectionBody}>
          {loading ? <ActivityIndicator color="#10b981" style={styles.loader} /> : null}
          {!loading && month ? (
            <FinancialAnalyticalSummaryReportView
              endMonth={month}
              realizedEntries={realizedEntries}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(30, 58, 138, 0.12)',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionLabel: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    color: '#5AA8E3',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionBody: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingBottom: 12,
    maxHeight: 560,
  },
  loader: {
    marginVertical: 24,
  },
  reportScrollContent: {
    paddingBottom: 4,
  },
  reportRoot: {
    minWidth: 720,
    gap: 12,
    paddingTop: 4,
  },
  reportTitleBar: {
    backgroundColor: '#1E3A5F',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  reportTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  tableCard: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  sectionBanner: {
    backgroundColor: '#1E3A5F',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sectionBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  tableHeaderRow: {
    backgroundColor: '#1E3A5F',
    borderTopWidth: 0,
  },
  subHeaderRow: {
    backgroundColor: '#D6E4F0',
    borderTopWidth: 0,
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  totalRow: {
    backgroundColor: '#EEF2FF',
  },
  totalRowFocus: {
    backgroundColor: '#FDE68A',
  },
  headerCell: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'right',
  },
  headerCellLeft: {
    textAlign: 'left',
  },
  headerCellFocus: {
    backgroundColor: '#FBBF24',
    color: '#1E293B',
  },
  subHeaderCell: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 8,
    textAlign: 'right',
  },
  subHeaderLeft: {
    textAlign: 'left',
  },
  labelCell: {
    color: '#0F172A',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  labelBold: {
    fontWeight: '800',
  },
  amount: {
    color: '#0F172A',
    fontSize: 12,
    textAlign: 'right',
    paddingHorizontal: 6,
    paddingVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  amountHighlighted: {
    backgroundColor: 'transparent',
  },
  amountBold: {
    fontWeight: '800',
  },
  amountNegative: {
    color: '#DC2626',
  },
  periodLabelCol: {
    width: 140,
    flexGrow: 0,
    flexShrink: 0,
  },
  periodValueCol: {
    width: 120,
    flexGrow: 0,
    flexShrink: 0,
  },
  accountCol: {
    width: 160,
    flexGrow: 0,
    flexShrink: 0,
  },
  valueCol: {
    width: 150,
    flexGrow: 0,
    flexShrink: 0,
  },
  histLabelCol: {
    flex: 1,
  },
  histValueCol: {
    width: 180,
    flexGrow: 0,
    flexShrink: 0,
  },
  cellFocus: {
    backgroundColor: '#FEF3C7',
  },
});
