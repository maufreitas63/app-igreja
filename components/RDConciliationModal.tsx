import {
  EXPENSE_REPORT_SQL_HINT,
  fetchPendingExpenseReports,
  formatExpenseReportAmount,
  formatExpenseReportDateTime,
  reconcileExpenseReport,
  splitExpenseReportDescriptions,
  type ExpenseReportPendingRow,
} from '@/lib/expenseReport';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  financialId: string | null;
  onClose: () => void;
  onReconciled?: (reportId: string) => void;
};

export function RDConciliationModal({ visible, financialId, onClose, onReconciled }: Props) {
  const [loading, setLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExpenseReportPendingRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pending = await fetchPendingExpenseReports();
      setRows(pending);
    } catch (err) {
      console.error('Erro ao listar RDs pendentes:', err);
      setRows([]);
      setError(
        err instanceof Error && err.message.includes('EXPENSE_REPORT_RPC_MISSING')
          ? EXPENSE_REPORT_SQL_HINT
          : 'Não foi possível carregar os relatórios pendentes.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadPending();
    }
  }, [loadPending, visible]);

  const handleReconcile = async (reportId: string) => {
    if (!financialId) {
      return;
    }

    setReconcilingId(reportId);

    try {
      const result = await reconcileExpenseReport(reportId, financialId);

      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Conciliação RD',
        text2: result.message,
      });

      if (result.success) {
        onReconciled?.(reportId);
        onClose();
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Conciliação RD',
        text2: err instanceof Error ? err.message : 'Não foi possível vincular o RD.',
      });
    } finally {
      setReconcilingId(null);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Vincular RD</Text>
          <Text style={styles.subtitle}>Selecione um relatório pendente para vincular a este lançamento.</Text>

          {loading ? (
            <ActivityIndicator color="#34D399" size="large" style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum RD pendente no momento.</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {rows.map((row) => {
                const descriptions = splitExpenseReportDescriptions(row.item_descriptions);

                return (
                <View key={row.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowNumber}>{row.report_number}</Text>
                    <Text style={styles.rowAmount}>{formatExpenseReportAmount(row.total_amount)}</Text>
                  </View>
                  <Text style={styles.rowMeta}>
                    {row.member_name} · {row.member_phone}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatExpenseReportDateTime(row.created_at)} · {row.items_count} item(ns)
                  </Text>
                  {descriptions.length > 0 ? (
                    <View style={styles.rowDescriptions}>
                      {descriptions.map((description) => (
                        <Text
                          key={`${row.id}-${description}`}
                          style={styles.rowDescriptionLine}
                          numberOfLines={2}
                        >
                          {description}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => void handleReconcile(row.id)}
                    disabled={reconcilingId !== null}
                    activeOpacity={0.85}
                  >
                    {reconcilingId === row.id ? (
                      <ActivityIndicator color="#0F172A" size="small" />
                    ) : (
                      <>
                        <FontAwesome name="link" size={13} color="#0F172A" />
                        <Text style={styles.linkButtonText}>Vincular a este lançamento</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '82%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    padding: 16,
    gap: 10,
  },
  title: {
    color: '#ECFDF5',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  loader: {
    paddingVertical: 24,
  },
  errorText: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: 10,
    paddingBottom: 4,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 12,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowNumber: {
    color: '#D1FAE5',
    fontSize: 14,
    fontWeight: '800',
  },
  rowAmount: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '800',
  },
  rowMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  rowDescriptions: {
    gap: 2,
    marginTop: 2,
  },
  rowDescriptionLine: {
    color: '#BFDBFE',
    fontSize: 11,
    lineHeight: 15,
  },
  linkButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#34D399',
    paddingVertical: 10,
    minHeight: 40,
  },
  linkButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
});
