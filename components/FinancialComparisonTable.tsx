import {
  type BulletinComparisonRow,
  type BulletinComparisonRowLevel,
} from '@/lib/financialBulletinComparison';
import { formatBulletinAmount } from '@/lib/financialBulletin';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  FINANCIAL_REPORT_TABLE_LAYOUT_MAX_HEIGHT,
  financialReportTableBodyScrollStyle,
  financialReportTableFrameStyle,
  financialReportTableLayoutStyle,
} from '@/lib/financialReportTableLayout';

const LABEL_COLUMN_WIDTH = 132;
const VALUE_COLUMN_WIDTH = 88;
const TRIPLE_VALUES_TABLE_WIDTH = VALUE_COLUMN_WIDTH * 3;

export type FinancialComparisonTableProps = {
  title: string;
  periodLabel: string;
  hint: string;
  rows: BulletinComparisonRow[];
  emptyMessage: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  displayMode?: 'triple' | 'single';
  leftColumnHeader?: string;
  rightColumnHeader?: string;
  variationColumnHeader?: string;
  valueColumnHeader?: string;
};

const AmountCell = ({
  value,
  bold,
}: {
  value: number;
  bold?: boolean;
}) => {
  const negative = value < 0;

  return (
    <Text
      style={[
        styles.valueCell,
        bold && styles.valueBold,
        negative ? styles.valueNegative : styles.valuePositive,
      ]}
      numberOfLines={2}
    >
      {formatBulletinAmount(value)}
    </Text>
  );
};

const VariationCell = ({ value, bold }: { value: number; bold?: boolean }) => {
  const negative = value < 0;
  const neutral = Math.abs(value) < 0.009;

  return (
    <Text
      style={[
        styles.valueCell,
        bold && styles.valueBold,
        neutral
          ? styles.valueNeutral
          : negative
            ? styles.valueNegative
            : styles.valuePositive,
      ]}
      numberOfLines={2}
    >
      {neutral ? '—' : formatBulletinAmount(value)}
    </Text>
  );
};

const labelStyleForLevel = (level: BulletinComparisonRowLevel) => {
  if (level === 'block') {
    return styles.rowLabelBlock;
  }

  if (level === 'flow') {
    return styles.rowLabelFlow;
  }

  if (level === 'line') {
    return styles.rowLabelLine;
  }

  if (level === 'total') {
    return styles.rowLabelTotal;
  }

  return styles.rowLabelBalance;
};

const TripleValuesCells = ({
  row,
  bold,
}: {
  row: BulletinComparisonRow;
  bold: boolean;
}) => (
  <View style={styles.valuesRow}>
    <AmountCell value={row.previousValue} bold={bold} />
    <AmountCell value={row.currentValue} bold={bold} />
    <VariationCell value={row.variation} bold={bold} />
  </View>
);

const SingleValueCell = ({
  row,
  bold,
}: {
  row: BulletinComparisonRow;
  bold: boolean;
}) => (
  <View style={styles.valuesRow}>
    <AmountCell value={row.currentValue} bold={bold} />
  </View>
);

export function FinancialComparisonTable({
  title,
  periodLabel,
  hint,
  leftColumnHeader = '',
  rightColumnHeader = '',
  variationColumnHeader = 'Variação',
  valueColumnHeader = 'Acumulado',
  displayMode = 'triple',
  rows,
  emptyMessage,
  icon = 'bar-chart',
}: FinancialComparisonTableProps) {
  const isSingleColumn = displayMode === 'single';
  const valuesTableWidth = isSingleColumn ? VALUE_COLUMN_WIDTH : TRIPLE_VALUES_TABLE_WIDTH;
  const labelsScrollRef = useRef<ScrollView>(null);

  const handleBodyScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    labelsScrollRef.current?.scrollTo({ y: offsetY, animated: false });
  }, []);

  if (!rows.length) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.reportHeader}>
        <FontAwesome name={icon} size={20} color="#0f172a" style={styles.reportIcon} />
        <View style={styles.reportHeaderText}>
          <Text style={styles.reportTitle}>{title}</Text>
          <Text style={styles.reportPeriod}>{periodLabel}</Text>
          <Text style={styles.reportHint}>{hint}</Text>
        </View>
      </View>

      <View style={styles.tableFrame}>
        <View style={styles.tableLayout}>
          <View style={styles.labelColumn}>
            <View style={styles.headerLabelCell}>
              <Text style={styles.headerLabel}>Descrição</Text>
            </View>
            <ScrollView
              ref={labelsScrollRef}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={styles.labelsBodyScroll}
              contentContainerStyle={styles.labelsBodyContent}
            >
              {rows.map((row) => (
                <View key={`${row.key}-label`} style={styles.labelBodyRow}>
                  <Text style={labelStyleForLevel(row.level)} numberOfLines={4}>
                    {row.label}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            horizontal
            bounces={false}
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            style={styles.valuesPane}
          >
            <View style={styles.valuesTable}>
              <View style={styles.valuesHeader}>
                <Text style={styles.headerValue}>{leftColumnHeader}</Text>
                <Text style={styles.headerValue}>{rightColumnHeader}</Text>
                <Text style={styles.headerValue}>{variationColumnHeader}</Text>
              </View>

              <ScrollView
                style={styles.valuesBodyScroll}
                contentContainerStyle={styles.valuesBodyContent}
                nestedScrollEnabled
                onScroll={handleBodyScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator
              >
                {rows.map((row) => {
                  const bold =
                    row.level === 'block' || row.level === 'total' || row.level === 'balance';

                  return (
                    <View key={`${row.key}-values`} style={styles.valuesBodyRow}>
                      <TripleValuesCells row={row} bold={bold} />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
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
  tableFrame: financialReportTableFrameStyle,
  tableLayout: financialReportTableLayoutStyle,
  labelColumn: {
    width: LABEL_COLUMN_WIDTH,
    height: FINANCIAL_REPORT_TABLE_LAYOUT_MAX_HEIGHT,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    zIndex: 2,
    overflow: 'hidden',
  },
  headerLabelCell: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  headerLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  labelsBodyScroll: {
    ...financialReportTableBodyScrollStyle,
    backgroundColor: '#FFFFFF',
  },
  labelsBodyContent: {},
  labelBodyRow: {
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  valuesPane: {
    flex: 1,
    height: FINANCIAL_REPORT_TABLE_LAYOUT_MAX_HEIGHT,
    overflow: 'hidden',
  },
  valuesTable: {},
  valuesHeader: {
    flexDirection: 'row',
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  headerValue: {
    width: VALUE_COLUMN_WIDTH,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  valuesBodyScroll: financialReportTableBodyScrollStyle,
  valuesBodyContent: {},
  valuesBodyRow: {
    minHeight: 34,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    justifyContent: 'center',
  },
  valuesRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  valueCell: {
    width: VALUE_COLUMN_WIDTH,
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 14,
  },
  valueBold: {
    fontWeight: '800',
  },
  valuePositive: {
    color: '#0F172A',
  },
  valueNegative: {
    color: '#DC2626',
  },
  valueNeutral: {
    color: '#94A3B8',
  },
  rowLabelBalance: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  rowLabelBlock: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rowLabelFlow: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    paddingLeft: 4,
  },
  rowLabelLine: {
    color: '#475569',
    fontSize: 10,
    lineHeight: 13,
    paddingLeft: 12,
  },
  rowLabelTotal: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
