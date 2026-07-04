import { AssemblyMinutesPdfModal } from '@/components/AssemblyMinutesPdfModal';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  createAssemblyMinuteSignedUrl,
  fetchAssemblyMinutes,
  normalizeAssemblyMinuteLabel,
  type AssemblyMinuteRecord,
} from '@/lib/assemblyMinutesApi';
import {
  fetchMaintenanceSupportRequests,
  MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS,
  MAINTENANCE_SUPPORT_STATUS_LABELS,
  type MaintenanceSupportRequest,
} from '@/lib/maintenanceSupportApi';
import {
  DASHBOARD_ADMINISTRATIVO_CARD_ID,
  SUGGESTIONS_IMPROVEMENTS_SCREEN,
} from '@/lib/administrativoModule';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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

type TabId = 'atas' | 'outros';

type Props = {
  panelHeight: number;
  isActive?: boolean;
  initialTab?: TabId;
};

const TABS: { id: TabId; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'atas', label: 'Atos Constitutivos', icon: 'description' },
  { id: 'outros', label: 'Outros', icon: 'folder-open' },
];

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function AdministrativoCard({ panelHeight, isActive = true, initialTab }: Props) {
  const router = useRouter();
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'atas');

  const [minutes, setMinutes] = useState<AssemblyMinuteRecord[]>([]);
  const [loadingMinutes, setLoadingMinutes] = useState(false);
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [minutesModalOpen, setMinutesModalOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; url: string } | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<MaintenanceSupportRequest[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [completedActionModal, setCompletedActionModal] = useState<{
    title: string;
    action: string;
  } | null>(null);

  const loadMinutes = useCallback(async () => {
    setLoadingMinutes(true);
    setMinutesError(null);

    try {
      const rows = await fetchAssemblyMinutes();
      setMinutes(rows);
    } catch (error) {
      setMinutes([]);
      setMinutesError(
        error instanceof Error ? error.message : 'Não foi possível carregar as atas.'
      );
    } finally {
      setLoadingMinutes(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);

    try {
      const result = await fetchMaintenanceSupportRequests(120);
      setSuggestions(result.rows);
    } catch (error) {
      setSuggestions([]);
      setSuggestionsError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar sugestões e melhorias.'
      );
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (activeTab === 'outros') {
      void loadSuggestions();
    }
  }, [activeTab, isActive, loadSuggestions]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useFocusEffect(
    useCallback(() => {
      if (!isActive || activeTab !== 'outros') {
        return;
      }

      void loadSuggestions();
    }, [activeTab, isActive, loadSuggestions])
  );

  const handleRegisterSuggestion = useCallback(() => {
    router.push({
      pathname: SUGGESTIONS_IMPROVEMENTS_SCREEN,
      params: {
        supportMode: 'new',
        returnDashboardCard: DASHBOARD_ADMINISTRATIVO_CARD_ID,
      },
    });
  }, [router]);

  const handleOpenAtasModal = useCallback(() => {
    setActiveTab('atas');
    setMinutesModalOpen(true);
    void loadMinutes();
  }, [loadMinutes]);

  const handleOpenPdf = useCallback(async (minute: AssemblyMinuteRecord) => {
    setLoadingPdfId(minute.id);

    try {
      const url = minute.signedUrl ?? (await createAssemblyMinuteSignedUrl(minute.storage_path));

      if (!url) {
        throw new Error('Não foi possível gerar o link de visualização do PDF.');
      }

      setPdfPreview({ title: minute.title, url });
    } catch (error) {
      setMinutesError(
        error instanceof Error ? error.message : 'Não foi possível abrir o PDF.'
      );
    } finally {
      setLoadingPdfId(null);
    }
  }, []);

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Administrativo</Text>
      <Text style={styles.subtitle}>
        Documentos administrativos e acompanhamento de sugestões.
      </Text>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabChip, selected && styles.tabChipSelected]}
              onPress={() => {
                if (tab.id === 'atas') {
                  handleOpenAtasModal();
                  return;
                }

                setActiveTab(tab.id);
              }}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name={tab.icon}
                size={16}
                color={selected ? '#1E3A8A' : '#BFDBFE'}
              />
              <Text style={[styles.tabChipText, selected && styles.tabChipTextSelected]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bodyCard}>
        {activeTab === 'atas' ? (
          <>
            <FontAwesome name="file-text-o" size={28} color="#60A5FA" />
            <Text style={styles.bodyTitle}>Atos Constitutivos</Text>
            <Text style={styles.bodyHint}>
              Consulte os PDFs publicados pelo financeiro. Toque no botão abaixo para abrir a lista.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleOpenAtasModal}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Ver documentos publicados</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ScrollView
            style={styles.suggestionsScroll}
            contentContainerStyle={styles.suggestionsContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.suggestionsHeaderRow}>
              <Text style={[styles.bodyTitle, styles.suggestionsHeaderTitle]}>
                Sugestões e Melhorias
              </Text>
              <TouchableOpacity
                style={styles.registerSuggestionButton}
                onPress={handleRegisterSuggestion}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Registrar sugestão ou melhoria"
              >
                <MaterialIcons name="add-circle-outline" size={16} color="#0F172A" />
                <Text style={styles.registerSuggestionButtonText}>Registrar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.bodyHint}>
              Solicitações registradas no relatório de Sugestões e Melhorias.
            </Text>

            {loadingSuggestions ? (
              <ActivityIndicator color="#60A5FA" style={styles.inlineLoader} />
            ) : suggestionsError ? (
              <Text style={styles.errorText}>{suggestionsError}</Text>
            ) : suggestions.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma solicitação registrada.</Text>
            ) : (
              suggestions.map((request) => {
                const isCompleted = request.status === 'completed';
                const CardWrapper = isCompleted ? TouchableOpacity : View;

                return (
                  <CardWrapper
                    key={request.id}
                    style={[
                      styles.suggestionCard,
                      isCompleted && styles.suggestionCardCompleted,
                    ]}
                    {...(isCompleted
                      ? {
                          onPress: () =>
                            setCompletedActionModal({
                              title: MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS[request.record_type],
                              action:
                                request.developer_action?.trim()
                                || 'Nenhuma ação registrada pelo desenvolvedor.',
                            }),
                          activeOpacity: 0.85,
                        }
                      : {})}
                  >
                    <View style={styles.suggestionHeader}>
                      <Text style={styles.suggestionType}>
                        {MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS[request.record_type]}
                      </Text>
                      <Text
                        style={[
                          styles.suggestionStatus,
                          isCompleted && styles.suggestionStatusCompleted,
                        ]}
                      >
                        {MAINTENANCE_SUPPORT_STATUS_LABELS[request.status]}
                      </Text>
                    </View>
                    <Text style={styles.suggestionMeta}>
                      {request.requester_name} · {formatDateTime(request.created_at)}
                    </Text>
                    {request.tema ? (
                      <Text style={styles.suggestionTheme}>{request.tema}</Text>
                    ) : null}
                    <Text style={styles.suggestionDescription} numberOfLines={4}>
                      {request.description}
                    </Text>
                    {isCompleted ? (
                      <Text style={styles.suggestionCompletedHint}>
                        Toque para ver a ação tomada
                      </Text>
                    ) : null}
                  </CardWrapper>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      <Modal
        visible={minutesModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMinutesModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setMinutesModalOpen(false)}
          />

          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Atos Constitutivos</Text>
            <Text style={styles.modalHelp}>
              Selecione um arquivo para visualizar o PDF na tela.
            </Text>

            {minutesError ? <Text style={styles.errorText}>{minutesError}</Text> : null}

            {loadingMinutes ? (
              <ActivityIndicator color="#60A5FA" style={styles.inlineLoader} />
            ) : (
              <ScrollView
                style={styles.minutesList}
                contentContainerStyle={styles.minutesListContent}
                nestedScrollEnabled
              >
                {minutes.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma ata publicada ainda.</Text>
                ) : (
                  minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute.id}
                      style={styles.minuteRow}
                      onPress={() => void handleOpenPdf(minute)}
                      disabled={loadingPdfId === minute.id}
                      activeOpacity={0.85}
                    >
                      <View style={styles.minuteMain}>
                        <Text style={styles.minuteTitle} numberOfLines={2}>
                          {minute.title}
                        </Text>
                        <Text style={styles.minuteMeta}>
                          {formatDateTime(minute.created_at)} ·{' '}
                          {normalizeAssemblyMinuteLabel(minute.file_name.replace(/\.pdf$/i, ''))}
                          .pdf
                        </Text>
                      </View>
                      {loadingPdfId === minute.id ? (
                        <ActivityIndicator color="#60A5FA" size="small" />
                      ) : (
                        <FontAwesome name="file-pdf-o" size={18} color="#F87171" />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setMinutesModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AssemblyMinutesPdfModal
        visible={pdfPreview !== null}
        title={pdfPreview?.title ?? 'Ata'}
        pdfUrl={pdfPreview?.url ?? null}
        onClose={() => setPdfPreview(null)}
      />

      <Modal
        visible={completedActionModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletedActionModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setCompletedActionModal(null)}
          />

          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ação Tomada</Text>
            {completedActionModal?.title ? (
              <Text style={styles.modalHelp}>{completedActionModal.title}</Text>
            ) : null}
            <ScrollView
              style={styles.actionTakenScroll}
              contentContainerStyle={styles.actionTakenContent}
              nestedScrollEnabled
            >
              <Text style={styles.actionTakenText}>
                {completedActionModal?.action ?? '—'}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setCompletedActionModal(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(30, 58, 138, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabChipSelected: {
    backgroundColor: '#BFDBFE',
    borderColor: '#93C5FD',
  },
  tabChipText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
  },
  tabChipTextSelected: {
    color: '#1E3A8A',
  },
  bodyCard: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 16,
    gap: 8,
  },
  bodyTitle: {
    color: '#E0F2FE',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'center',
    marginTop: 8,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#60A5FA',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  suggestionsScroll: {
    flex: 1,
    minHeight: 0,
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  suggestionsHeaderTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  registerSuggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  registerSuggestionButtonText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  suggestionsContent: {
    gap: 8,
    paddingBottom: 8,
  },
  suggestionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    padding: 10,
    gap: 4,
  },
  suggestionCardCompleted: {
    borderColor: 'rgba(34, 197, 94, 0.55)',
    backgroundColor: 'rgba(20, 83, 45, 0.42)',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  suggestionType: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  suggestionStatus: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
  },
  suggestionStatusCompleted: {
    color: '#BBF7D0',
  },
  suggestionCompletedHint: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  suggestionMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  suggestionTheme: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionDescription: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  inlineLoader: {
    paddingVertical: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: '#0F172A',
    padding: 16,
    gap: 10,
    zIndex: 2,
  },
  modalTitle: {
    color: '#E0F2FE',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalHelp: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  minutesList: {
    flexGrow: 0,
    maxHeight: 360,
  },
  minutesListContent: {
    gap: 8,
  },
  minuteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.95)',
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    padding: 12,
  },
  minuteMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  minuteTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  minuteMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  actionTakenScroll: {
    maxHeight: 280,
  },
  actionTakenContent: {
    paddingVertical: 4,
  },
  actionTakenText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
  },
});
