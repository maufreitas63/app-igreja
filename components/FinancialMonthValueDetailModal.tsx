import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { boxShadowStyle } from '@/lib/boxShadow';
import { formatBulletinAmount } from '@/lib/financialBulletin';
import {
  formatFinancialMonthKey,
  formatFinancialMonthLabel,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const MONTH_DETAIL_ROW_HEIGHT = 33;
const DETAIL_BUBBLE_CHROME_RESERVE = 168;
const DETAIL_BUBBLE_SCROLL_MIN = 140;
/** Cap de ~12 linhas visíveis antes de rolar em telas altas. */
const DETAIL_SCROLL_CAP = MONTH_DETAIL_ROW_HEIGHT * 12;

export type FinancialMonthValueDetailItem = {
  month: FinancialMonthKey;
  value: number;
};

type FinancialMonthValueDetailModalProps = {
  title: string;
  items: FinancialMonthValueDetailItem[];
  visible: boolean;
  onClose: () => void;
  emptyMessage?: string;
};

/**
 * Balão modal Mês/Valor (ex.: detalhe de conta no resultado histórico ou 12 meses).
 * Ordenação esperada já decrescente; rolagem com indicador quando o conteúdo excede a tela.
 */
export function FinancialMonthValueDetailModal({
  title,
  items,
  visible,
  onClose,
  emptyMessage = 'Sem movimentação mensal para exibir.',
}: FinancialMonthValueDetailModalProps) {
  const { height: windowHeight } = useWindowDimensions();

  const cardMaxHeight = Math.min(windowHeight * 0.9, windowHeight - 48);
  const detailScrollMaxHeight = Math.max(
    DETAIL_BUBBLE_SCROLL_MIN,
    Math.min(DETAIL_SCROLL_CAP, cardMaxHeight - DETAIL_BUBBLE_CHROME_RESERVE)
  );
  const naturalContentHeight = Math.max(items.length, 1) * MONTH_DETAIL_ROW_HEIGHT;
  const needsScroll = naturalContentHeight > detailScrollMaxHeight + 1;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bubbleBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.bubbleCard, { maxHeight: cardMaxHeight }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.bubbleArrow} />
          <View style={styles.bubbleHeaderRow}>
            <Text style={styles.bubbleTitle} numberOfLines={4}>
              {title}
            </Text>
          </View>

          <View style={styles.monthDetailHeaderRow}>
            <Text style={[styles.monthDetailHeaderCell, styles.monthDetailMonthHeader]}>Mês</Text>
            <Text style={[styles.monthDetailHeaderCell, styles.monthDetailValueHeader]}>Valor</Text>
          </View>

          <ScrollView
            style={[
              styles.monthDetailScroll,
              { maxHeight: detailScrollMaxHeight },
              Platform.OS === 'web' ? ({ overflowY: 'scroll' } as object) : null,
            ]}
            contentContainerStyle={styles.monthDetailScrollContent}
            nestedScrollEnabled
            scrollEnabled
            showsVerticalScrollIndicator
            persistentScrollbar={needsScroll}
            bounces={needsScroll}
            indicatorStyle="black"
          >
            {items.length === 0 ? (
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            ) : (
              items.map(({ month, value }) => {
                const negative = value < 0;

                return (
                  <View
                    key={formatFinancialMonthKey(month)}
                    style={styles.monthDetailDataRow}
                  >
                    <Text style={[styles.monthDetailMonthCell, styles.monthDetailBodyCell]}>
                      {formatFinancialMonthLabel(month)}
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
              })
            )}
          </ScrollView>
          <CloseFooterBar onPress={onClose} accessibilityLabel="Fechar detalhamento mensal" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 0,
    gap: 8,
    overflow: 'hidden',
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
  bubbleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
    flexGrow: 0,
    flexShrink: 1,
    paddingHorizontal: 16,
  },
  monthDetailScrollContent: {
    gap: 0,
    paddingBottom: 4,
    paddingRight: 4,
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
  valuePositive: {
    color: '#0F172A',
  },
  valueNegative: {
    color: '#DC2626',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
