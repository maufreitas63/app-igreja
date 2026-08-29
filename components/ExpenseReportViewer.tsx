import { CloseButton } from '@/components/minimal/CloseFooterBar';
import {
  formatExpenseReportAmount,
  formatExpenseReportDate,
  formatExpenseReportDateTime,
  type ExpenseReportDetail,
} from '@/lib/expenseReport';
import { createFinancialReceiptSignedUrl } from '@/lib/financialReceipt';
import { MINIMAL_SECTION_TITLE, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  report: ExpenseReportDetail;
  memberName: string;
  memberPhone: string;
};

export function ExpenseReportViewer({
  report,
  memberName,
  memberPhone,
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const openReceipt = async (receiptUrl: string | null | undefined) => {
    if (!receiptUrl?.trim()) {
      return;
    }

    setPreviewVisible(true);
    setLoadingPreview(true);
    setPreviewUrl(null);

    try {
      const signedUrl = await createFinancialReceiptSignedUrl(receiptUrl);
      setPreviewUrl(signedUrl);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'RD',
        text2: err instanceof Error ? err.message : 'Não foi possível abrir o comprovante.',
      });
      setPreviewVisible(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{report.report_number}</Text>
      <Text style={styles.meta}>
        Criado em {formatExpenseReportDateTime(report.created_at)} ·{' '}
        {report.status === 'reconciled' ? 'Conciliado' : 'Pendente'}
      </Text>

      <View style={styles.headerCard}>
        <Text style={styles.headerLine}>Nome: {memberName}</Text>
        <Text style={styles.headerLine}>Telefone: {memberPhone}</Text>
        <Text style={styles.headerLine}>PIX: {report.pix_key}</Text>
        <Text style={styles.headerLine}>Total: {formatExpenseReportAmount(report.total_amount)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Itens</Text>
      {report.items.map((item, index) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>
              {index + 1}. {formatExpenseReportDate(item.date)}
            </Text>
            <Text style={styles.itemAmount}>{formatExpenseReportAmount(item.amount)}</Text>
          </View>
          <Text style={styles.itemDescription}>{item.description}</Text>
          {item.receipt_url ? (
            <TouchableOpacity
              style={styles.receiptLink}
              onPress={() => void openReceipt(item.receipt_url)}
              activeOpacity={0.85}
            >
              <FontAwesome name="image" size={13} color={MINIMAL_UI.blueDark} />
              <Text style={styles.receiptLinkText}>Ver comprovante</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noReceipt}>Sem comprovante</Text>
          )}
        </View>
      ))}

      <Modal transparent visible={previewVisible} animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewVisible(false)}>
          <Pressable style={styles.previewCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.previewTitle}>Comprovante</Text>
            {loadingPreview ? (
              <ActivityIndicator color={MINIMAL_UI.blueDark} size="large" style={styles.previewLoader} />
            ) : previewUrl ? (
              <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
            <CloseButton onPress={() => setPreviewVisible(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    marginBottom: 0,
    paddingVertical: 8,
  },
  meta: {
    ...MINIMAL_TYPO.inboxPreview,
    textAlign: 'center',
  },
  headerCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.rowHover,
    padding: 12,
    gap: 6,
  },
  headerLine: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
  },
  sectionTitle: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.background,
    padding: 12,
    gap: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  itemAmount: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  itemDescription: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  receiptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  receiptLinkText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  noReceipt: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    padding: 16,
    gap: 10,
  },
  previewTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  previewLoader: {
    paddingVertical: 24,
  },
  previewImage: {
    width: '100%',
    height: 280,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  previewClose: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  previewCloseText: {
    color: MINIMAL_UI.onDark,
    fontSize: 13,
    fontWeight: '700',
  },
});
