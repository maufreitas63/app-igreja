import type { BulletinComparisonRowLevel } from '@/lib/financialBulletinComparison';
import { formatBulletinAmount } from '@/lib/financialBulletin';
import { formatFinancialMonthLabel } from '@/lib/financialMonth';
import type { TwelveMonthMatrix, TwelveMonthMatrixRow } from '@/lib/financialTwelveMonthMatrix';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const LABEL_COLUMN_WIDTH = 132;
const VALUE_COLUMN_WIDTH = 76;
const BODY_MAX_HEIGHT = 420;
const ROW_DETAIL_ICON_COLOR = '#94A3B8';

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

const TwelveMonthRowDetailBubble = ({
  row,
  matrix,
  visible,
  onClose,
}: {
  row: TwelveMonthMatrixRow | null;
  matrix: TwelveMonthMatrix;
  visible: boolean;
  onClose: () => void;
}) => {
  if (!row) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bubbleBackdrop} onPress={onClose}>
        <Pressable style={styles.bubbleCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.bubbleArrow} />
          <View style={styles.bubbleHeaderRow}>
            <Text style={styles.bubbleTitle} numberOfLines={4}>
              {row.label}
            </Text>
            <TouchableOpacity
              style={styles.bubbleCloseIconButton}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhamento mensal"
            >
              <FontAwesome name="close" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.monthDetailHeaderRow}>
            <Text style={[styles.monthDetailHeaderCell, styles.monthDetailMonthHeader]}>Mês</Text>
            <Text style={[styles.monthDetailHeaderCell, styles.monthDetailValueHeader]}>Valor</Text>
          </View>

          <ScrollView
            style={styles.monthDetailScroll}
            contentContainerStyle={styles.monthDetailScrollContent}
            nestedScrollEnabled
          >
            {matrix.columns.map((column, index) => {
              const value = row.values[index] ?? 0;
              const negative = value < 0;

              return (
                <View key={`${row.key}-${column.header}`} style={styles.monthDetailDataRow}>
                  <Text style={[styles.monthDetailMonthCell, styles.monthDetailBodyCell]}>
                    {formatFinancialMonthLabel(column.month)}
                  </Text>
                  <Text
                    style={[
                      styles.monthDetailValueCell,
                      styles.monthDetailBodyCell,
                      negative ? styles.valueNegative : styles.valuePositive,
                    ]}
                  >
                    {formatBulletinAmount(value)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export function FinancialMultiMonthTable({
  title,
  periodLabel,
  hint,
  matrix,
  emptyMessage,
  icon = 'table',
}: FinancialMultiMonthTableProps) {
  const [selectedRow, setSelectedRow] = useState<TwelveMonthMatrixRow | null>(null);
  const tableWidth = LABEL_COLUMN_WIDTH + matrix.columns.length * VALUE_COLUMN_WIDTH;

  if (!matrix.rows.length) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      <TwelveMonthRowDetailBubble
        row={selectedRow}
        matrix={matrix}
        visible={selectedRow !== null}
        onClose={() => setSelectedRow(null)}
      />

      <View style={styles.reportHeader}>
        <FontAwesome name={icon} size={20} color="#0f172a" style={styles.reportIcon} />
        <View style={styles.reportHeaderText}>
          <Text style={styles.reportTitle}>{title}</Text>
          <Text style={styles.reportPeriod}>{periodLabel}</Text>
          <Text style={styles.reportHint}>{hint}</Text>
        </View>
      </View>

      <View style={styles.tableFrame}>
        <ScrollView
          horizontal
          bounces={false}
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          style={styles.tableHorizontalScroll}
        >
          <View style={[styles.tableContent, { width: tableWidth }]}>
            <View style={styles.tableHeaderRow}>
              <View style={styles.headerLabelCell}>
                <Text style={styles.headerLabel}>Descrição</Text>
              </View>
              <View style={styles.valuesHeader}>
                {matrix.columns.map((column) => (
                  <Text key={column.header} style={styles.headerValue}>
                    {column.header}
                  </Text>
                ))}
              </View>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {matrix.rows.map((row) => {
                const bold =
                  row.level === 'block' || row.level === 'total' || row.level === 'balance';

                return (
                  <View key={row.key} style={styles.dataRow}>
                    <TouchableOpacity
                      style={styles.labelBodyRow}
                      onPress={() => setSelectedRow(row)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver valores mensais de ${row.label}`}
                    >
                      <Text
                        style={[labelStyleForLevel(row.level), styles.labelBodyText]}
                        numberOfLines={4}
                      >
                        {row.label}
                      </Text>
                      <FontAwesome
                        name="bars"
                        size={10}
                        color={ROW_DETAIL_ICON_COLOR}
                        style={styles.rowDetailIcon}
                      />
                    </TouchableOpacity>
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
  tableHorizontalScroll: {
    maxHeight: BODY_MAX_HEIGHT + 40,
  },
  tableContent: {
    flexGrow: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  headerLabelCell: {
    width: LABEL_COLUMN_WIDTH,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bodyScroll: {
    maxHeight: BODY_MAX_HEIGHT,
    backgroundColor: '#FFFFFF',
  },
  bodyScrollContent: {
    flexGrow: 1,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  labelBodyRow: {
    width: LABEL_COLUMN_WIDTH,
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  labelBodyText: {
    flex: 1,
    minWidth: 0,
  },
  rowDetailIcon: {
    flexShrink: 0,
    opacity: 0.85,
  },
  valuesHeader: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  headerValue: {
    width: VALUE_COLUMN_WIDTH,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  valuesRow: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
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
  bubbleBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bubbleCard: {
    maxWidth: 380,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bubbleArrow: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#93C5FD',
    transform: [{ rotate: '45deg' }],
    left: '50%',
    marginLeft: -7,
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bubbleTitle: {
    flex: 1,
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  bubbleCloseIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexShrink: 0,
  },
  monthDetailHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    paddingBottom: 6,
    gap: 12,
  },
  monthDetailHeaderCell: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  monthDetailMonthHeader: {
    flex: 1,
    minWidth: 0,
  },
  monthDetailValueHeader: {
    width: 108,
    textAlign: 'right',
    flexShrink: 0,
  },
  monthDetailScroll: {
    maxHeight: 320,
  },
  monthDetailScrollContent: {
    gap: 0,
  },
  monthDetailDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  monthDetailBodyCell: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  monthDetailMonthCell: {
    flex: 1,
    minWidth: 0,
  },
  monthDetailValueCell: {
    width: 108,
    textAlign: 'right',
    fontWeight: '700',
    flexShrink: 0,
  },
});
