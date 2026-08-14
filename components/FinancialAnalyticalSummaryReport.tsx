import {
  buildFinancialAnalyticalSummaryReport,
  type AnalyticalAccountRow,
  type AnalyticalCashflowColumn,
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
  compact,
  align = 'right',
}: {
  value: number;
  highlighted?: boolean;
  bold?: boolean;
  compact?: boolean;
  align?: 'left' | 'center' | 'right';
}) => {
  const negative = value < -0.005;

  return (
    <Text
      style={[
        styles.amount,
        compact && styles.amountCompact,
        align === 'center' && styles.amountCenter,
        align === 'left' && styles.amountLeft,
        highlighted && styles.amountHighlighted,
        bold && styles.amountBold,
        negative && styles.amountNegative,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {formatFinancialBrl(value)}
    </Text>
  );
};

function ThreeMonthTable<T extends { month: FinancialMonthKey; header: string; isFocus: boolean }>({
  labelHeader,
  columns,
  rows,
}: {
  labelHeader: string;
  columns: T[];
  rows: { label: string; key: keyof T; bold?: boolean }[];
}) {
  return (
    <View style={styles.tableCard}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.headerCell, styles.periodLabelCol, styles.headerCellLeft]}>{labelHeader}</Text>
        {columns.map((column) => (
          <Text
            key={`${String(column.header)}-${column.month.year}-${column.month.month}`}
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
          key={String(row.key)}
          style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt, row.bold && styles.totalRow]}
        >
          <Text style={[styles.labelCell, styles.periodLabelCol, row.bold && styles.labelBold]}>
            {row.label}
          </Text>
          {columns.map((column) => (
            <View
              key={`${String(row.key)}-${column.month.year}-${column.month.month}`}
              style={[styles.periodValueCol, column.isFocus && styles.cellFocus]}
            >
              <AmountCell
                value={Number(column[row.key]) || 0}
                highlighted={column.isFocus}
                bold={row.bold}
                compact
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function CashflowTable({ columns }: { columns: AnalyticalCashflowColumn[] }) {
  return (
    <ThreeMonthTable
      labelHeader="Movimento"
      columns={columns}
      rows={[
        { label: 'Entradas', key: 'entradas' },
        { label: 'Saídas', key: 'saidas' },
        { label: 'Total', key: 'total', bold: true },
      ]}
    />
  );
}

function PeriodTable({ columns }: { columns: AnalyticalPeriodColumn[] }) {
  return (
    <ThreeMonthTable
      labelHeader="Período"
      columns={columns}
      rows={[
        { label: 'Ordinário', key: 'ordinario' },
        { label: 'Extraordinário', key: 'extraordinario' },
        { label: 'Resultado total', key: 'total', bold: true },
      ]}
    />
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
        <Text style={[styles.subHeaderCell, styles.valueCol]}>Ordinários</Text>
        <Text style={[styles.subHeaderCell, styles.valueCol]}>Extraordinários</Text>
        <Text style={[styles.subHeaderCell, styles.valueCol]}>Total</Text>
      </View>

      {rows.map((row, index) => (
        <View key={row.account} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
          <Text style={[styles.labelCell, styles.accountCol]} numberOfLines={2}>
            {row.account}
          </Text>
          <View style={styles.valueCol}>
            <AmountCell value={row.ordinario} compact />
          </View>
          <View style={styles.valueCol}>
            <AmountCell value={row.extraordinario} compact />
          </View>
          <View style={styles.valueCol}>
            <AmountCell value={row.total} bold compact />
          </View>
        </View>
      ))}

      <View style={[styles.tableRow, styles.totalRow, styles.totalRowFocus, styles.totalRowBorder]}>
        <Text style={[styles.labelCell, styles.accountCol, styles.labelBold]}>TOTAL</Text>
        <View style={styles.valueCol}>
          <AmountCell value={totals.ordinario} bold highlighted compact />
        </View>
        <View style={styles.valueCol}>
          <AmountCell value={totals.extraordinario} bold highlighted compact />
        </View>
        <View style={styles.valueCol}>
          <AmountCell value={totals.total} bold highlighted compact />
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
  const cells = [
    { label: 'Ordinário', value: historical.ordinario },
    { label: 'Extraordinário', value: historical.extraordinario },
    { label: 'Saldo acumulado', value: historical.saldo, bold: true, focus: true },
  ] as const;

  return (
    <View style={styles.tableCard}>
      <View style={styles.sectionBanner}>
        <Text style={styles.sectionBannerText}>ACUMULADO HISTÓRICO</Text>
      </View>

      <View style={[styles.tableRow, styles.subHeaderRow]}>
        {cells.map((cell, index) => (
          <Text
            key={`h-${cell.label}`}
            style={[
              styles.subHeaderCell,
              styles.histCol,
              index === 0 && styles.histColFirst,
              styles.subHeaderCenter,
              cell.focus && styles.subHeaderFocus,
            ]}
          >
            {cell.label}
          </Text>
        ))}
      </View>

      <View style={[styles.tableRow, styles.totalRow]}>
        {cells.map((cell, index) => (
          <View
            key={`v-${cell.label}`}
            style={[
              styles.histCol,
              index === 0 && styles.histColFirst,
              styles.histValueCell,
              cell.focus && styles.cellFocus,
            ]}
          >
            <AmountCell
              value={cell.value}
              bold={cell.bold}
              highlighted={cell.focus}
              compact
              align="center"
            />
          </View>
        ))}
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
      nestedScrollEnabled
      showsVerticalScrollIndicator
      contentContainerStyle={styles.reportScrollContent}
    >
      <View style={styles.reportRoot}>
        <View style={styles.reportTitleBar}>
          <Text style={styles.reportTitle}>
            RESUMO FINANCEIRO {formatFinancialMonthLabel(endMonth)}
          </Text>
        </View>

        <CashflowTable columns={report.cashflowColumns} />
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

export function FinancialAnalyticalSummarySection({
  month,
  realizedEntries,
  loading = false,
  expanded,
  onToggle,
}: FinancialAnalyticalSummarySectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          accessibilityLabel="Resumo Financeiro"
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          activeOpacity={0.85}
          onPress={onToggle}
          style={styles.sectionHeaderToggle}
          disabled={!month}
        >
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionLabel}>Resumo Financeiro</Text>
            {month ? (
              <Text style={styles.sectionMeta}>{formatFinancialMonthLabel(month)}</Text>
            ) : (
              <Text style={styles.sectionMeta}>Selecione o mês de referência</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={expanded ? 'Recolher resumo' : 'Expandir resumo'}
          activeOpacity={0.85}
          onPress={onToggle}
          disabled={!month}
          style={styles.sectionChevronButton}
        >
          <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

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
    gap: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderToggle: {
    flex: 1,
  },
  sectionChevronButton: {
    padding: 6,
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    maxHeight: 640,
  },
  loader: {
    marginVertical: 24,
  },
  reportScrollContent: {
    paddingBottom: 8,
  },
  reportRoot: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 10,
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  reportTitleBar: {
    backgroundColor: '#1E3A5F',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  reportTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
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
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  sectionBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 32,
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
  totalRowBorder: {
    borderTopWidth: 2,
    borderTopColor: '#F59E0B',
  },
  headerCell: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 7,
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
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 6,
    textAlign: 'right',
  },
  subHeaderLeft: {
    textAlign: 'left',
  },
  subHeaderCenter: {
    textAlign: 'center',
  },
  subHeaderFocus: {
    backgroundColor: '#FBBF24',
  },
  labelCell: {
    color: '#0F172A',
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  labelBold: {
    fontWeight: '800',
  },
  amount: {
    color: '#0F172A',
    fontSize: 11,
    textAlign: 'right',
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  amountCompact: {
    fontSize: 10,
    paddingHorizontal: 2,
  },
  amountCenter: {
    textAlign: 'center',
    width: '100%',
  },
  amountLeft: {
    textAlign: 'left',
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
    flex: 1.15,
    minWidth: 96,
  },
  periodValueCol: {
    flex: 1,
    minWidth: 84,
  },
  accountCol: {
    flex: 1.2,
    minWidth: 96,
  },
  valueCol: {
    flex: 1,
    minWidth: 88,
  },
  histCol: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#CBD5E1',
  },
  histColFirst: {
    borderLeftWidth: 0,
  },
  histValueCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cellFocus: {
    backgroundColor: '#FEF3C7',
  },
});
