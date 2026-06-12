import { ExpenseReportForm } from '@/components/ExpenseReportForm';
import { ExpenseReportViewer } from '@/components/ExpenseReportViewer';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import {
  deleteExpenseReport,
  EXPENSE_REPORT_SQL_HINT,
  fetchExpenseReportDetail,
  fetchMyExpenseReports,
  loadExpenseReportHeader,
  notifyTreasurerExpenseReportSubmitted,
  splitExpenseReportDescriptions,
  submitExpenseReport,
  type ExpenseReportDetail,
  type ExpenseReportHeader,
  type ExpenseReportSummary,
} from '@/lib/expenseReport';
import { confirmDialog } from '@/lib/confirmDialog';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type ScreenMode = 'list' | 'create' | 'view';

export default function ExpenseReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportIdParam = typeof params.id === 'string' ? params.id : undefined;

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.expenseReport,
    deniedMessage: 'Você não tem permissão para abrir o Relatório de Despesas.',
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [header, setHeader] = useState<ExpenseReportHeader | null>(null);
  const [reports, setReports] = useState<ExpenseReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<ExpenseReportDetail | null>(null);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [loadedHeader, myReports] = await Promise.all([
        loadExpenseReportHeader(),
        fetchMyExpenseReports(),
      ]);

      setHeader(loadedHeader);
      setReports(myReports);

      if (reportIdParam) {
        const detail = await fetchExpenseReportDetail(reportIdParam);

        if (detail) {
          setSelectedReport(detail);
          setMode('view');
        }
      }
    } catch (err) {
      console.error('Erro ao carregar RD:', err);
      setError(
        err instanceof Error && err.message.includes('EXPENSE_REPORT_RPC_MISSING')
          ? EXPENSE_REPORT_SQL_HINT
          : 'Não foi possível carregar o módulo de Relatório de Despesas.'
      );
    } finally {
      setLoading(false);
    }
  }, [reportIdParam]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const memberName = header?.fullName ?? '—';
  const memberPhone = header?.phone ?? '—';

  const pendingCount = useMemo(
    () => reports.filter((report) => report.status === 'pending').length,
    [reports]
  );

  const handleCancelCreate = async () => {
    const confirmed = await confirmDialog(
      'Cancelar relatório',
      'Deseja descartar este relatório de despesas sem salvar?',
      'Cancelar relatório',
      'Continuar editando',
      { destructive: true }
    );

    if (confirmed) {
      setMode('list');
    }
  };

  const handleFinalize = async (input: Parameters<typeof submitExpenseReport>[0]) => {
    setSubmitting(true);

    try {
      const result = await submitExpenseReport(input);

      if (!result.success) {
        Toast.show({
          type: 'error',
          text1: 'RD',
          text2: result.message,
          visibilityTime: 5000,
        });
        return;
      }

      setReports((current) => [result.report, ...current]);
      setSelectedReport(null);
      setMode('list');

      const whatsappResult = await notifyTreasurerExpenseReportSubmitted({
        memberName: header?.fullName?.trim() || 'Usuário',
        reportNumber: result.report.report_number,
        totalAmount: result.report.total_amount,
      });

      if (whatsappResult.missingTreasurerPhone) {
        Toast.show({
          type: 'info',
          text1: 'RD',
          text2: `${result.report.report_number} criado. Configure Tesoureiro_contato para avisar o tesoureiro.`,
          visibilityTime: 5000,
        });
      } else if (!whatsappResult.opened) {
        Toast.show({
          type: 'success',
          text1: 'RD',
          text2: `${result.report.report_number} criado. Não foi possível abrir o WhatsApp do tesoureiro.`,
          visibilityTime: 5000,
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'RD',
          text2: `${result.report.report_number} submetido. WhatsApp do tesoureiro aberto.`,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReport = async (report: ExpenseReportSummary) => {
    const confirmed = await confirmDialog(
      'Excluir relatório',
      `Deseja excluir o ${report.report_number}? Esta ação não pode ser desfeita.`,
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    const previousReports = reports;
    setDeletingReportId(report.id);
    setReports((current) => current.filter((entry) => entry.id !== report.id));

    if (selectedReport?.id === report.id) {
      setSelectedReport(null);
      setMode('list');
    }

    try {
      const result = await deleteExpenseReport(report.id);

      if (!result.success) {
        setReports(previousReports);
        Toast.show({
          type: 'error',
          text1: 'RD',
          text2: result.message,
        });
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'RD',
        text2: result.message,
      });
    } catch (err) {
      setReports(previousReports);
      Toast.show({
        type: 'error',
        text1: 'RD',
        text2:
          err instanceof Error && err.message.includes('EXPENSE_REPORT_RPC_MISSING')
            ? EXPENSE_REPORT_SQL_HINT
            : err instanceof Error
              ? err.message
              : 'Não foi possível excluir o relatório.',
      });
    } finally {
      setDeletingReportId(null);
    }
  };

  const openReport = async (reportId: string) => {
    setLoading(true);

    try {
      const detail = await fetchExpenseReportDetail(reportId);

      if (!detail) {
        Toast.show({
          type: 'error',
          text1: 'RD',
          text2: 'Relatório não encontrado.',
        });
        return;
      }

      setSelectedReport(detail);
      setMode('view');
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'RD',
        text2: err instanceof Error ? err.message : 'Não foi possível abrir o relatório.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenAccessGate status={accessStatus}>
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            accessibilityLabel="Voltar"
            onPress={() => {
              if (mode === 'list') {
                router.back();
                return;
              }

              setMode('list');
              setSelectedReport(null);
            }}
            style={styles.headerBackButton}
            activeOpacity={0.85}
          >
            <Text style={styles.headerBackText}>{'‹'}</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Relatório de Despesas</Text>
            <Text style={styles.subtitle}>RD · reembolso de despesas</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sheet}>
            {loading ? <CardLoadingState label="Carregando RD..." /> : null}

            {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

            {!loading && !error && mode === 'list' ? (
              <View style={styles.listContainer}>
                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>Meus relatórios</Text>
                  <Text style={styles.listHint}>
                    {pendingCount > 0
                      ? `${pendingCount} pendente(s) aguardando tesouraria`
                      : 'Nenhum RD pendente'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => setMode('create')}
                  activeOpacity={0.85}
                >
                  <FontAwesome name="plus" size={14} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Novo RD</Text>
                </TouchableOpacity>

                {reports.length === 0 ? (
                  <Text style={styles.emptyText}>Você ainda não enviou nenhum relatório.</Text>
                ) : (
                  reports.map((report) => {
                    const descriptions = splitExpenseReportDescriptions(report.item_descriptions);

                    return (
                      <View key={report.id} style={styles.reportCard}>
                        <TouchableOpacity
                          onPress={() => void openReport(report.id)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.reportCardHeader}>
                            <Text style={styles.reportNumber}>{report.report_number}</Text>
                            <Text
                              style={[
                                styles.reportStatus,
                                report.status === 'pending' && styles.reportStatusPending,
                              ]}
                            >
                              {report.status === 'reconciled' ? 'Conciliado' : 'Pendente'}
                            </Text>
                          </View>
                          <Text style={styles.reportMeta}>
                            {report.total_amount.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </Text>
                          {descriptions.length > 0 ? (
                            <View style={styles.reportDescriptions}>
                              {descriptions.map((description) => (
                                <Text
                                  key={`${report.id}-${description}`}
                                  style={styles.reportDescriptionLine}
                                  numberOfLines={2}
                                >
                                  {description}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                        </TouchableOpacity>

                        {report.status === 'pending' ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.deleteReportButton,
                              deletingReportId === report.id && styles.deleteReportButtonDisabled,
                              pressed && styles.deleteReportButtonPressed,
                            ]}
                            onPress={(event) => {
                              event?.stopPropagation?.();
                              void handleDeleteReport(report);
                            }}
                            disabled={deletingReportId === report.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Excluir ${report.report_number}`}
                          >
                            <FontAwesome name="trash-o" size={14} color="#FFFFFF" />
                            <Text style={styles.deleteReportButtonText}>
                              {deletingReportId === report.id ? 'Excluindo...' : 'Excluir RD'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {!loading && !error && mode === 'create' && header ? (
              <ExpenseReportForm
                header={header}
                submitting={submitting}
                onSubmit={handleFinalize}
                onCancel={handleCancelCreate}
              />
            ) : null}

            {!loading && !error && mode === 'view' && selectedReport ? (
              <ExpenseReportViewer
                report={selectedReport}
                memberName={memberName}
                memberPhone={memberPhone}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  headerBackText: {
    color: '#E2E8F0',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '300',
  },
  headerTitles: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    minHeight: 220,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
  },
  listContainer: {
    gap: 12,
  },
  listHeader: {
    gap: 4,
  },
  listTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  listHint: {
    color: '#64748B',
    fontSize: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#059669',
    paddingVertical: 12,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reportNumber: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  reportStatus: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reportMeta: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  reportStatusPending: {
    color: '#B45309',
  },
  reportDescriptions: {
    marginTop: 6,
    gap: 2,
  },
  reportDescriptionLine: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  deleteReportButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
  },
  deleteReportButtonDisabled: {
    opacity: 0.6,
  },
  deleteReportButtonPressed: {
    opacity: 0.85,
  },
  deleteReportButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
