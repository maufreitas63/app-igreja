import type { BulletinComparisonRowLevel } from '@/lib/financialBulletinComparison';
import { formatBulletinAmount } from '@/lib/financialBulletin';
import type { TwelveMonthMatrix } from '@/lib/financialTwelveMonthMatrix';
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

const LABEL_COLUMN_WIDTH = 132;
const VALUE_COLUMN_WIDTH = 76;
const BODY_MAX_HEIGHT = 420;

export type FinancialMultiMonthTableProps = {
  title: string;
  periodLabel: string;
  hint: string;
  matrix: TwelveMonthMatrix;
  emptyMessage: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
};

const AmountCell = ({ value, bold }: { value: number; bold?: boolean }) => {
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

export function FinancialMultiMonthTable({
  title,
  periodLabel,
  hint,
  matrix,
  emptyMessage,
  icon = 'table',
}: FinancialMultiMonthTableProps) {
  const labelsScrollRef = useRef<ScrollView>(null);
  const valuesTableWidth = matrix.columns.length * VALUE_COLUMN_WIDTH;

  const handleBodyScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    labelsScrollRef.current?.scrollTo({ y: offsetY, animated: false });
  }, []);

  if (!matrix.rows.length) {
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
              {matrix.rows.map((row) => (
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
            <View style={[styles.valuesTable, { width: valuesTableWidth }]}>
              <View style={styles.valuesHeader}>
                {matrix.columns.map((column) => (
                  <Text key={column.header} style={styles.headerValue}>
                    {column.header}
                  </Text>
                ))}
              </View>

              <ScrollView
                style={styles.valuesBodyScroll}
                contentContainerStyle={styles.valuesBodyContent}
                nestedScrollEnabled
                onScroll={handleBodyScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator
              >
                {matrix.rows.map((row) => {
                  const bold =
                    row.level === 'block' || row.level === 'total' || row.level === 'balance';

                  return (
                    <View key={`${row.key}-values`} style={styles.valuesBodyRow}>
                      <View style={styles.valuesRow}>
                        {row.values.map((value, index) => (
                          <AmountCell
                            key={`${row.key}-${matrix.columns[index]?.header ?? index}`}
                            value={value}
                            bold={bold}
                          />
                        ))}
                      </View>
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
  tableFrame: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableLayout: {
    flexDirection: 'row',
    maxHeight: BODY_MAX_HEIGHT + 40,
  },
  labelColumn: {
    width: LABEL_COLUMN_WIDTH,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    zIndex: 2,
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
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  labelsBodyContent: {
    flexGrow: 1,
  },
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
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  valuesBodyScroll: {
    maxHeight: BODY_MAX_HEIGHT,
  },
  valuesBodyContent: {
    flexGrow: 1,
  },
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
    fontSize: 10,
    lineHeight: 13,
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
