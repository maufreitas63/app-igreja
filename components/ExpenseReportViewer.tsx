import {
  formatExpenseReportAmount,
  formatExpenseReportDate,
  formatExpenseReportDateTime,
  type ExpenseReportDetail,
} from '@/lib/expenseReport';
import { createFinancialReceiptSignedUrl } from '@/lib/financialReceipt';
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
  onSendWhatsapp?: () => void;
  whatsappBusy?: boolean;
};

export function ExpenseReportViewer({
  report,
  memberName,
  memberPhone,
  onSendWhatsapp,
  whatsappBusy = false,
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
              <FontAwesome name="image" size={13} color="#059669" />
              <Text style={styles.receiptLinkText}>Ver comprovante</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noReceipt}>Sem comprovante</Text>
          )}
        </View>
      ))}

      {onSendWhatsapp && report.status === 'pending' ? (
        <TouchableOpacity
          style={[styles.whatsappButton, whatsappBusy && styles.whatsappButtonDisabled]}
          onPress={onSendWhatsapp}
          disabled={whatsappBusy}
          activeOpacity={0.85}
        >
          {whatsappBusy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <FontAwesome name="whatsapp" size={16} color="#FFFFFF" />
              <Text style={styles.whatsappButtonText}>Enviar ao tesoureiro (WhatsApp)</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      <Modal transparent visible={previewVisible} animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewVisible(false)}>
          <Pressable style={styles.previewCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.previewTitle}>Comprovante</Text>
            {loadingPreview ? (
              <ActivityIndicator color="#059669" size="large" style={styles.previewLoader} />
            ) : previewUrl ? (
              <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
            <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewVisible(false)}>
              <Text style={styles.previewCloseText}>Fechar</Text>
            </TouchableOpacity>
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
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: '#64748B',
    fontSize: 12,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 6,
  },
  headerLine: {
    color: '#334155',
    fontSize: 14,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
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
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  itemAmount: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  itemDescription: {
    color: '#475569',
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
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  noReceipt: {
    color: '#94A3B8',
    fontSize: 12,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    minHeight: 48,
  },
  whatsappButtonDisabled: {
    opacity: 0.7,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    padding: 16,
    gap: 10,
  },
  previewTitle: {
    color: '#065F46',
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
    backgroundColor: '#F8FAFC',
  },
  previewClose: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  previewCloseText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
});
