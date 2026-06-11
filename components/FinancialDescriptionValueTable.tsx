import {
  type BulletinComparisonRow,
  type BulletinComparisonRowLevel,
} from '@/lib/financialBulletinComparison';
import { formatBulletinAmount } from '@/lib/financialBulletin';
import {
  findCommentDetailsForBulletinRow,
  findReceiptForBulletinRow,
  type FinancialBulletinCommentDetail,
  type FinancialEntry,
} from '@/lib/financialEntry';
import { createFinancialReceiptSignedUrl } from '@/lib/financialReceipt';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  FINANCIAL_REPORT_TABLE_BODY_MAX_HEIGHT,
  financialReportTableFrameStyle,
  financialReportTableLayoutMaxHeight,
} from '@/lib/financialReportTableLayout';

const LABEL_COLUMN_WIDTH = 128;
const VALUE_COLUMN_MIN_WIDTH = 108;
const ICON_SLOT_WIDTH = 24;
const ICON_COLUMN_WIDTH = ICON_SLOT_WIDTH * 2 + 4;
const COMMENT_ICON_COLOR = '#2563EB';
const RECEIPT_ICON_COLOR = '#059669';

const formatCommentDetailAmount = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);

export type FinancialDescriptionValueTableProps = {
  rows: BulletinComparisonRow[];
  /** Lançamentos do mês (para casar `comments` com linhas do boletim). */
  entries?: FinancialEntry[];
  valueColumnHeader?: string;
  emptyMessage?: string;
  /** Terceira coluna com ícone de observação quando a linha tiver `comment`. */
  showCommentIcons?: boolean;
  /** Altura máxima do corpo rolável (padrão: comparativos; boletim mensal usa valor menor). */
  maxBodyHeight?: number;
};

const AmountCell = ({
  value,
  bold,
  compact,
}: {
  value: number;
  bold?: boolean;
  compact?: boolean;
}) => {
  const negative = value < 0;

  return (
    <Text
      style={[
        styles.valueCell,
        compact && styles.valueCellCompact,
        bold && styles.valueBold,
        negative ? styles.valueNegative : styles.valuePositive,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
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

  if (level === 'balance') {
    return styles.rowLabelBalance;
  }

  return styles.rowLabelDefault;
};

const CommentIndicator = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel="Ver observação do lançamento"
    style={styles.iconButton}
    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
  >
    <View style={styles.commentIconBadge}>
      <FontAwesome name="info-circle" size={16} color={COMMENT_ICON_COLOR} />
    </View>
  </TouchableOpacity>
);

const ReceiptIndicator = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel="Ver comprovante do lançamento"
    style={styles.iconButton}
    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
  >
    <View style={styles.receiptIconBadge}>
      <FontAwesome5 name="receipt" size={13} color={RECEIPT_ICON_COLOR} solid />
    </View>
  </TouchableOpacity>
);

const ReceiptImageModal = ({
  receiptUrl,
  visible,
  onClose,
}: {
  receiptUrl: string;
  visible: boolean;
  onClose: () => void;
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !receiptUrl) {
      setSignedUrl(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSignedUrl(null);

    void createFinancialReceiptSignedUrl(receiptUrl)
      .then((url) => {
        if (cancelled) {
          return;
        }

        if (!url) {
          setLoadError('Não foi possível abrir o comprovante.');
          return;
        }

        setSignedUrl(url);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setLoadError(
          err instanceof Error ? err.message : 'Não foi possível carregar o comprovante.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [receiptUrl, visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bubbleBackdrop} onPress={onClose}>
        <Pressable style={styles.receiptModalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.receiptModalTitle}>Comprovante</Text>
          {loading ? (
            <ActivityIndicator color="#059669" size="large" style={styles.receiptModalLoader} />
          ) : loadError ? (
            <Text style={styles.receiptModalError}>{loadError}</Text>
          ) : signedUrl ? (
            <Image
              source={{ uri: signedUrl }}
              style={styles.receiptModalImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity style={styles.bubbleCloseButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.bubbleCloseButtonText}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const CommentDetailsModal = ({
  details,
  visible,
  onClose,
}: {
  details: FinancialBulletinCommentDetail[];
  visible: boolean;
  onClose: () => void;
}) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.bubbleBackdrop} onPress={onClose}>
      <Pressable style={styles.bubbleCard} onPress={(event) => event.stopPropagation()}>
        <View style={styles.bubbleArrow} />
        <Text style={styles.bubbleTitle}>Observações</Text>
        <View style={styles.commentDetailsHeaderRow}>
          <Text style={[styles.commentDetailsHeaderCell, styles.commentDetailsDateHeader]}>Data</Text>
          <Text style={[styles.commentDetailsHeaderCell, styles.commentDetailsCommentHeader]}>
            Observação
          </Text>
          <View style={styles.commentDetailsAmountColumn}>
            <Text style={[styles.commentDetailsHeaderCell, styles.commentDetailsAmountHeader]}>
              Valor
            </Text>
          </View>
        </View>
        <ScrollView
          style={styles.commentDetailsScroll}
          contentContainerStyle={styles.commentDetailsScrollContent}
          nestedScrollEnabled
        >
          {details.map((detail, index) => (
            <View
              key={`${detail.transactionDateLabel}-${detail.comment}-${detail.amount}-${index}`}
              style={styles.commentDetailsDataRow}
            >
              <Text style={[styles.commentDetailsBodyCell, styles.commentDetailsDateCell]}>
                {detail.transactionDateLabel}
              </Text>
              <View style={styles.commentDetailsCommentColumn}>
                <Text style={[styles.commentDetailsBodyCell, styles.commentDetailsCommentCell]}>
                  {detail.comment}
                </Text>
              </View>
              <View style={styles.commentDetailsAmountColumn}>
                <Text
                  style={[
                    styles.commentDetailsBodyCell,
                    styles.commentDetailsAmountCell,
                    detail.amount < 0 ? styles.valueNegative : styles.valuePositive,
                  ]}
                >
                  {formatCommentDetailAmount(detail.amount)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.bubbleCloseButton} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.bubbleCloseButtonText}>Fechar</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

export function FinancialDescriptionValueTable({
  rows,
  entries = [],
  valueColumnHeader = 'VALOR',
  emptyMessage = 'Nenhum lançamento para exibir neste mês.',
  showCommentIcons = false,
  maxBodyHeight = FINANCIAL_REPORT_TABLE_BODY_MAX_HEIGHT,
}: FinancialDescriptionValueTableProps) {
  const [openCommentDetails, setOpenCommentDetails] = useState<FinancialBulletinCommentDetail[] | null>(
    null
  );
  const [openReceiptUrl, setOpenReceiptUrl] = useState<string | null>(null);
  const tableLayoutHeight = financialReportTableLayoutMaxHeight(maxBodyHeight);

  const commentDetailsByRowKey = useMemo(() => {
    if (!showCommentIcons) {
      return new Map<string, FinancialBulletinCommentDetail[]>();
    }

    const map = new Map<string, FinancialBulletinCommentDetail[]>();

    for (const row of rows) {
      const details = findCommentDetailsForBulletinRow(row, entries);

      if (details.length > 0) {
        map.set(row.key, details);
      }
    }

    return map;
  }, [entries, rows, showCommentIcons]);

  const receiptByRowKey = useMemo(() => {
    if (!showCommentIcons) {
      return new Map<string, string>();
    }

    const map = new Map<string, string>();

    for (const row of rows) {
      const receiptUrl = findReceiptForBulletinRow(row, entries)?.trim() || '';

      if (receiptUrl) {
        map.set(row.key, receiptUrl);
      }
    }

    return map;
  }, [entries, rows, showCommentIcons]);

  if (!rows.length) {
    return <Text style={styles.emptyText}>{emptyMessage}</Text>;
  }

  const valueColumnMinWidth = showCommentIcons ? 0 : VALUE_COLUMN_MIN_WIDTH;
  const tableMinWidth = showCommentIcons
    ? undefined
    : LABEL_COLUMN_WIDTH + VALUE_COLUMN_MIN_WIDTH;

  const tablePanel = (
    <View
      style={[
        styles.tableFrame,
        showCommentIcons ? styles.tableFrameFluid : null,
        tableMinWidth ? { minWidth: tableMinWidth } : null,
      ]}
    >
      <View
        style={[
          styles.tableLayout,
          tableMinWidth ? { minWidth: tableMinWidth } : styles.tableLayoutFluid,
          { height: tableLayoutHeight, maxHeight: tableLayoutHeight },
        ]}
      >
        <View style={styles.tableHeaderRow}>
          <View style={[styles.headerLabelCell, styles.labelColumnCell]}>
            <Text style={styles.headerLabel}>Descrição</Text>
          </View>
          <View style={[styles.headerValueCell, { minWidth: valueColumnMinWidth }]}>
            <Text style={styles.headerValue}>{valueColumnHeader}</Text>
          </View>
          {showCommentIcons ? <View style={styles.headerIconCell} /> : null}
        </View>

        <ScrollView
          style={[styles.bodyScroll, { height: maxBodyHeight, maxHeight: maxBodyHeight }]}
          contentContainerStyle={styles.bodyContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {rows.map((row) => {
            const bold =
              row.level === 'block' ||
              row.level === 'flow' ||
              row.level === 'total' ||
              row.level === 'balance';
            const commentDetails = commentDetailsByRowKey.get(row.key) ?? [];
            const receiptUrl = receiptByRowKey.get(row.key) ?? '';
            const showCommentIcon = commentDetails.length > 0;
            const showReceiptIcon = receiptUrl.length > 0;

            return (
              <View key={row.key} style={styles.dataRow}>
                <View style={[styles.labelBodyCell, styles.labelColumnCell]}>
                  <Text style={labelStyleForLevel(row.level)} numberOfLines={4}>
                    {row.label}
                  </Text>
                </View>
                <View style={[styles.valueBodyCell, { minWidth: valueColumnMinWidth }]}>
                  <AmountCell value={row.currentValue} bold={bold} compact={showCommentIcons} />
                </View>
                {showCommentIcons ? (
                  <View style={styles.iconBodyCell}>
                    <View style={styles.iconSlot}>
                      {showCommentIcon ? (
                        <CommentIndicator onPress={() => setOpenCommentDetails(commentDetails)} />
                      ) : null}
                    </View>
                    <View style={styles.iconSlot}>
                      {showReceiptIcon ? (
                        <ReceiptIndicator onPress={() => setOpenReceiptUrl(receiptUrl)} />
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <>
      {showCommentIcons ? (
        <View style={[styles.tableFluidHost, { maxHeight: tableLayoutHeight }]}>{tablePanel}</View>
      ) : (
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator
          style={[styles.tableHorizontalScroll, { maxHeight: tableLayoutHeight }]}
          contentContainerStyle={styles.tableHorizontalContent}
        >
          {tablePanel}
        </ScrollView>
      )}

      <CommentDetailsModal
        details={openCommentDetails ?? []}
        visible={Boolean(openCommentDetails?.length)}
        onClose={() => setOpenCommentDetails(null)}
      />

      <ReceiptImageModal
        receiptUrl={openReceiptUrl ?? ''}
        visible={Boolean(openReceiptUrl)}
        onClose={() => setOpenReceiptUrl(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tableFluidHost: {
    alignSelf: 'stretch',
    width: '100%',
  },
  tableHorizontalScroll: {
    flexGrow: 0,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  tableHorizontalContent: {
    flexGrow: 0,
  },
  tableFrame: financialReportTableFrameStyle,
  tableFrameFluid: {
    width: '100%',
  },
  tableLayout: {
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tableLayoutFluid: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  labelColumnCell: {
    width: LABEL_COLUMN_WIDTH,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerLabelCell: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  headerLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerValueCell: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerValue: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    backgroundColor: '#FFFFFF',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  labelBodyCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  valueBodyCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  iconBodyCell: {
    width: ICON_COLUMN_WIDTH,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingLeft: 4,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
  },
  iconSlot: {
    width: ICON_SLOT_WIDTH,
    height: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentIconBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 11,
  },
  receiptIconBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 11,
  },
  valueCell: {
    textAlign: 'right',
    fontSize: 13,
    lineHeight: 16,
  },
  valueCellCompact: {
    fontSize: 12,
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
  rowLabelBalance: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  rowLabelTotal: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  rowLabelDefault: {
    color: '#334155',
    fontSize: 12,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  bubbleBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bubbleCard: {
    maxWidth: 420,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
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
  bubbleTitle: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  commentDetailsHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    paddingBottom: 6,
    gap: 10,
  },
  commentDetailsHeaderCell: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  commentDetailsDateHeader: {
    width: 44,
    flexShrink: 0,
    textAlign: 'center',
  },
  commentDetailsCommentHeader: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  commentDetailsAmountColumn: {
    width: 104,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  commentDetailsAmountHeader: {
    width: '100%',
    textAlign: 'right',
  },
  commentDetailsScroll: {
    maxHeight: 220,
  },
  commentDetailsScrollContent: {
    gap: 8,
    paddingTop: 4,
  },
  commentDetailsDataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  commentDetailsBodyCell: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  commentDetailsDateCell: {
    width: 44,
    flexShrink: 0,
    textAlign: 'center',
    fontWeight: '600',
  },
  commentDetailsCommentColumn: {
    flex: 1,
    minWidth: 0,
  },
  commentDetailsCommentCell: {
    flexShrink: 1,
    textAlign: 'left',
    ...(Platform.OS === 'web'
      ? ({
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        } as const)
      : null),
  },
  commentDetailsAmountCell: {
    width: '100%',
    textAlign: 'right',
    fontWeight: '700',
  },
  bubbleCloseButton: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bubbleCloseButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  receiptModalCard: {
    maxWidth: 420,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  receiptModalTitle: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  receiptModalLoader: {
    paddingVertical: 24,
  },
  receiptModalError: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 12,
  },
  receiptModalImage: {
    width: '100%',
    height: 280,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
});
