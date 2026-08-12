import {
  createFinancialAnalyticalSummarySignedUrl,
} from '@/lib/financialAnalyticalSummary';
import { formatFinancialMonthLabel, type FinancialMonthKey } from '@/lib/financialMonth';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

type FinancialAnalyticalSummaryButtonProps = {
  month: FinancialMonthKey | null;
};

export function FinancialAnalyticalSummaryButton({ month }: FinancialAnalyticalSummaryButtonProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!month) {
      setSignedUrl(null);
      setErrorMessage('Selecione um mês de referência.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSignedUrl(null);

    try {
      const url = await createFinancialAnalyticalSummarySignedUrl(month);

      if (!url) {
        setErrorMessage(
          `Não há “Resumo Financeiro” para ${formatFinancialMonthLabel(month)}. ` +
            'Envie o arquivo pelo comprovantes em lote no padrão AAAAMM Resumo Financeiro.jpg ' +
            `(ex.: ${month.year}${String(month.month).padStart(2, '0')} Resumo Financeiro.jpg).`
        );
        return;
      }

      setSignedUrl(url);
    } catch (error) {
      console.error('Erro ao carregar Resumo Financeiro:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível carregar o relatório analítico.'
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (!visible) {
      setSignedUrl(null);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    void loadSummary();
  }, [loadSummary, visible]);

  return (
    <>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          activeOpacity={0.85}
          onPress={() => setVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Relatório Analítico / Resumo Financeiro"
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
          <FontAwesome name="chevron-right" size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Relatório Analítico / Resumo Financeiro</Text>
              {month ? (
                <Text style={styles.modalSubtitle}>{formatFinancialMonthLabel(month)}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVisible(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Fechar relatório analítico"
            >
              <FontAwesome name="close" size={18} color="#E2E8F0" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {loading ? <ActivityIndicator color="#10b981" size="large" /> : null}

            {!loading && errorMessage ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{errorMessage}</Text>
                <Pressable style={styles.retryButton} onPress={() => void loadSummary()}>
                  <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}

            {!loading && signedUrl ? (
              <Image
                source={{ uri: signedUrl }}
                style={{ width: windowWidth, height: Math.max(windowHeight - 72, 320) }}
                resizeMode="contain"
                accessibilityLabel="Imagem do Resumo Financeiro"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </>
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
  modalRoot: {
    flex: 1,
    backgroundColor: '#020617',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalHeaderText: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  modalBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  messageBox: {
    maxWidth: 420,
    paddingHorizontal: 24,
    gap: 14,
    alignItems: 'center',
  },
  messageText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#134E4A',
  },
  retryButtonText: {
    color: '#5EEAD4',
    fontWeight: '700',
    fontSize: 13,
  },
});
