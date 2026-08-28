import { boxShadowStyle } from '@/lib/boxShadow';
import {
  type BulletinComparisonRow,
  type BulletinComparisonRowLevel,
} from '@/lib/financialBulletinComparison';
import { formatBulletinAmount } from '@/lib/financialBulletin';
import {
  findCommentDetailsForBulletinRow,
  findExpenseReportInfoForBulletinRow,
  findReceiptInfoForBulletinRow,
  type FinancialBulletinCommentDetail,
  type FinancialEntry,
} from '@/lib/financialEntry';
import { createFinancialReceiptSignedUrl } from '@/lib/financialReceipt';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  useWindowDimensions,
  View,
} from 'react-native';

import {
  FINANCIAL_REPORT_TABLE_BODY_MAX_HEIGHT,
  financialReportLabelColumnWidth,
  financialReportTableFrameStyle,
  financialReportTableLayoutMaxHeight,
} from '@/lib/financialReportTableLayout';

const VALUE_COLUMN_MIN_WIDTH = 108;
const ICON_SLOT_WIDTH = 24;
const ICON_COLUMN_WIDTH = ICON_SLOT_WIDTH * 3 + 8;
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
  /** Ao informar, cada linha abre detalhe (ex.: série mensal no resultado histórico). */
  onRowPress?: (row: BulletinComparisonRow) => void;
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
      minimumFontScale={0.7}
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

const ReceiptIndicator = ({
  onPress,
  multipleAttachments = false,
}: {
  onPress: () => void;
  multipleAttachments?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel={
      multipleAttachments
        ? 'Ver comprovante do lançamento. Há mais de um anexo.'
        : 'Ver comprovante do lançamento'
    }
    style={styles.iconButton}
    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
  >
    <View style={styles.receiptIconSlot}>
      <View style={styles.receiptIconBadge}>
        {multipleAttachments ? (
          <Text style={styles.receiptMultipleOnly}>+</Text>
        ) : (
          <FontAwesome5 name="receipt" size={13} color={RECEIPT_ICON_COLOR} solid />
        )}
      </View>
    </View>
  </TouchableOpacity>
);

const ExpenseReportIndicator = ({
  onPress,
  reportNumber,
}: {
  onPress: () => void;
  reportNumber?: string | null;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel={
      reportNumber ? `Ver relatório de despesas ${reportNumber}` : 'Ver relatório de despesas'
    }
    style={styles.iconButton}
    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
  >
    <View style={styles.receiptIconSlot}>
      <View style={styles.receiptIconBadge}>
        <FontAwesome5 name="file-alt" size={13} color={RECEIPT_ICON_COLOR} solid />
      </View>
    </View>
  </TouchableOpacity>
);

const ReceiptImageModal = ({
  receiptUrls,
  visible,
  onClose,
  initialIndex = 0,
}: {
  receiptUrls: string[];
  visible: boolean;
  onClose: () => void;
  initialIndex?: number;
}) => {
  const urls = useMemo(
    () => receiptUrls.map((url) => url.trim()).filter(Boolean),
    [receiptUrls]
  );
  const [index, setIndex] = useState(initialIndex);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentReceiptUrl = urls[index] ?? '';
  const hasMultiple = urls.length > 1;
  const canGoPrevious = index > 0;
  const canGoNext = index < urls.length - 1;

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      setSignedUrl(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(urls.length - 1, 0)));
  }, [initialIndex, urls.length, visible]);

  useEffect(() => {
    if (!visible || !currentReceiptUrl) {
      setSignedUrl(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSignedUrl(null);

    void createFinancialReceiptSignedUrl(currentReceiptUrl)
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
  }, [currentReceiptUrl, visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bubbleBackdrop} onPress={onClose}>
        <Pressable style={styles.receiptModalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.receiptModalTitle}>
            Comprovante{hasMultiple ? ` ${index + 1}/${urls.length}` : ''}
          </Text>
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
          <View style={styles.receiptModalActions}>
            {hasMultiple ? (
              <TouchableOpacity
                style={[
                  styles.receiptModalNavButton,
                  !canGoPrevious && styles.receiptModalNavButtonDisabled,
                ]}
                onPress={() => setIndex((current) => Math.max(current - 1, 0))}
                disabled={!canGoPrevious}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.receiptModalNavButtonText,
                    !canGoPrevious && styles.receiptModalNavButtonTextDisabled,
                  ]}
                >
                  Anterior
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.receiptModalNavSpacer} />
            )}
            <TouchableOpacity style={styles.bubbleCloseButton} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.bubbleCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
            {hasMultiple ? (
              <TouchableOpacity
                style={[
                  styles.receiptModalNavButton,
                  !canGoNext && styles.receiptModalNavButtonDisabled,
                ]}
                onPress={() => setIndex((current) => Math.min(current + 1, urls.length - 1))}
                disabled={!canGoNext}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.receiptModalNavButtonText,
                    !canGoNext && styles.receiptModalNavButtonTextDisabled,
                  ]}
                >
                  Próximo
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.receiptModalNavSpacer} />
            )}
          </View>
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
}) => {
  const [openReceiptUrls, setOpenReceiptUrls] = useState<string[] | null>(null);

  useEffect(() => {
    if (!visible) {
      setOpenReceiptUrls(null);
    }
  }, [visible]);

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.bubbleBackdrop} onPress={onClose}>
          <Pressable style={styles.bubbleCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.bubbleArrow} />
            <Text style={styles.bubbleTitle}>Observações</Text>
            <View style={styles.commentDetailsHeaderRow}>
              <Text style={[styles.commentDetailsHeaderCell, styles.commentDetailsDateHeader]}>
                Data
              </Text>
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
              {details.map((detail, index) => {
                const receiptUrls = detail.receiptUrls?.length
                  ? detail.receiptUrls
                  : detail.receiptUrl?.trim()
                    ? [detail.receiptUrl.trim()]
                    : [];

                return (
                  <View
                    key={`${detail.transactionDateLabel}-${detail.comment}-${detail.amount}-${receiptUrls.join('|')}-${index}`}
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
                      {receiptUrls.length ? (
                        <View style={styles.commentDetailsReceiptSlot}>
                          <ReceiptIndicator
                            onPress={() => setOpenReceiptUrls(receiptUrls)}
                            multipleAttachments={receiptUrls.length > 1}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.bubbleCloseButton} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.bubbleCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ReceiptImageModal
        receiptUrls={openReceiptUrls ?? []}
        visible={Boolean(openReceiptUrls?.length)}
        onClose={() => setOpenReceiptUrls(null)}
      />
    </>
  );
};

export function FinancialDescriptionValueTable({
  rows,
  entries = [],
  valueColumnHeader = 'VALOR',
  emptyMessage = 'Nenhum lançamento para exibir neste mês.',
  showCommentIcons = false,
  maxBodyHeight = FINANCIAL_REPORT_TABLE_BODY_MAX_HEIGHT,
  onRowPress,
}: FinancialDescriptionValueTableProps) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const labelColumnWidth = financialReportLabelColumnWidth(windowWidth);
  const [openCommentDetails, setOpenCommentDetails] = useState<FinancialBulletinCommentDetail[] | null>(
    null
  );
  const [openReceiptUrls, setOpenReceiptUrls] = useState<string[] | null>(null);
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
      return new Map<string, ReturnType<typeof findReceiptInfoForBulletinRow>>();
    }

    const map = new Map<string, ReturnType<typeof findReceiptInfoForBulletinRow>>();

    for (const row of rows) {
      const receiptInfo = findReceiptInfoForBulletinRow(row, entries);

      if (receiptInfo.receiptCount > 0) {
        map.set(row.key, receiptInfo);
      }
    }

    return map;
  }, [entries, rows, showCommentIcons]);

  const expenseReportByRowKey = useMemo(() => {
    if (!showCommentIcons) {
      return new Map<string, ReturnType<typeof findExpenseReportInfoForBulletinRow>>();
    }

    const map = new Map<string, ReturnType<typeof findExpenseReportInfoForBulletinRow>>();

    for (const row of rows) {
      const expenseReportInfo = findExpenseReportInfoForBulletinRow(row, entries);

      if (expenseReportInfo.reportCount > 0) {
        map.set(row.key, expenseReportInfo);
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
    : labelColumnWidth + VALUE_COLUMN_MIN_WIDTH;
  const labelColumnStyle = [styles.labelColumnCell, { width: labelColumnWidth }];

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
          <View style={[styles.headerLabelCell, labelColumnStyle]}>
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
            const receiptInfo = receiptByRowKey.get(row.key);
            const expenseReportInfo = expenseReportByRowKey.get(row.key);
            const receiptUrls = receiptInfo?.receiptUrls ?? [];
            const showCommentIcon = commentDetails.length > 0;
            const showReceiptIcon = receiptUrls.length > 0;
            const showExpenseReportIcon = Boolean(expenseReportInfo?.reportId);
            const hasMultipleReceipts = receiptUrls.length > 1;

            const rowBody = (
              <>
                <View style={[styles.labelBodyCell, labelColumnStyle]}>
                  <View style={styles.labelBodyInner}>
                    <Text
                      style={[labelStyleForLevel(row.level), styles.labelBodyText]}
                      numberOfLines={4}
                    >
                      {row.label}
                    </Text>
                    {onRowPress ? (
                      <FontAwesome
                        name="bars"
                        size={10}
                        color="#94A3B8"
                        style={styles.rowDetailIcon}
                      />
                    ) : null}
                  </View>
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
                        <ReceiptIndicator
                          onPress={() => setOpenReceiptUrls(receiptUrls)}
                          multipleAttachments={hasMultipleReceipts}
                        />
                      ) : null}
                    </View>
                    <View style={styles.iconSlot}>
                      {showExpenseReportIcon && expenseReportInfo?.reportId ? (
                        <ExpenseReportIndicator
                          reportNumber={expenseReportInfo.reportNumber}
                          onPress={() =>
                            router.push(
                              `/expense-report?id=${encodeURIComponent(expenseReportInfo.reportId!)}`
                            )
                          }
                        />
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </>
            );

            if (onRowPress) {
              return (
                <TouchableOpacity
                  key={row.key}
                  style={styles.dataRow}
                  onPress={() => onRowPress(row)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver valores mensais de ${row.label}`}
                >
                  {rowBody}
                </TouchableOpacity>
              );
            }

            return (
              <View key={row.key} style={styles.dataRow}>
                {rowBody}
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
        receiptUrls={openReceiptUrls ?? []}
        visible={Boolean(openReceiptUrls?.length)}
        onClose={() => setOpenReceiptUrls(null)}
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
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerLabelCell: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 6,
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
  headerIconCell: {
    width: ICON_COLUMN_WIDTH,
    flexShrink: 0,
    minHeight: 36,
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
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  labelBodyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  labelBodyText: {
    flex: 1,
    minWidth: 0,
  },
  rowDetailIcon: {
    flexShrink: 0,
    opacity: 0.85,
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
  receiptIconSlot: {
    width: ICON_SLOT_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  receiptIconBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 11,
    position: 'relative',
  },
  receiptMultipleOnly: {
    color: RECEIPT_ICON_COLOR,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
    width: '100%',
  },
  valueCell: {
    width: '100%',
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 15,
    ...(Platform.OS === 'web'
      ? ({ whiteSpace: 'nowrap', overflow: 'visible' } as object)
      : null),
  },
  valueCellCompact: {
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
    ...boxShadowStyle({
      color: '#0F172A',
      offsetY: 4,
      blurRadius: 12,
      opacity: 0.12,
      elevation: 6,
    }),
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
  commentDetailsReceiptSlot: {
    marginTop: 4,
    alignItems: 'flex-end',
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
    ...boxShadowStyle({
      color: '#0F172A',
      offsetY: 4,
      blurRadius: 12,
      opacity: 0.12,
      elevation: 6,
    }),
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
  receiptModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  receiptModalNavButton: {
    minWidth: 84,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
  },
  receiptModalNavButtonDisabled: {
    opacity: 0.45,
  },
  receiptModalNavButtonText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  receiptModalNavButtonTextDisabled: {
    color: '#94A3B8',
  },
  receiptModalNavSpacer: {
    minWidth: 84,
  },
});
