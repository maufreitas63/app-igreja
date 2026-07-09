import { AssemblyMinutesPdfModal } from '@/components/AssemblyMinutesPdfModal';
import { MaintenanceSupportSuggestionsCard } from '@/components/MaintenanceSupportSuggestionsCard';
import {
  createAssemblyMinuteSignedUrl,
  fetchAssemblyMinutes,
  normalizeAssemblyMinuteLabel,
  type AssemblyMinuteRecord,
} from '@/lib/assemblyMinutesApi';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { computeDashboardCardHeight } from '@/lib/dashboardPanelLayout';
import {
  fetchMaintenanceSupportRequests,
  MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS,
  MAINTENANCE_SUPPORT_STATUS_LABELS,
  type MaintenanceSupportRequest,
} from '@/lib/maintenanceSupportApi';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ADMINISTRATIVO_CLASS_SURFACE = '#FFFFFF';
const ADMINISTRATIVO_CLASS_ICON_COLOR = '#1B4F8A';

type TabId = 'atas' | 'outros';

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

export type AdministrativoClassProps = {
  title?: string;
  description?: string;
  rdButtonLabel?: string;
  initialTab?: TabId;
  onPressRd?: () => void;
};

/** Visualização do módulo Administrativo — abas + RD via props. */
export function AdministrativoClass({
  title = 'Administrativo',
  description = 'Documentos administrativos, sugestões e relatórios de despesas.',
  rdButtonLabel = 'Criar Relatório de Despesas (RD)',
  initialTab = 'atas',
  onPressRd,
}: AdministrativoClassProps) {
  const { height: windowHeight } = useWindowDimensions();
  const panelHeight = useMemo(
    () => computeDashboardCardHeight(windowHeight, 0, 0),
    [windowHeight]
  );
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

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
  const [registerSuggestionOpen, setRegisterSuggestionOpen] = useState(false);

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
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'outros') {
      void loadSuggestions();
    }
  }, [activeTab, loadSuggestions]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'outros') {
        return;
      }

      void loadSuggestions();
    }, [activeTab, loadSuggestions])
  );

  const handleRegisterSuggestion = useCallback(() => {
    setRegisterSuggestionOpen(true);
  }, []);

  const handleCloseRegisterSuggestion = useCallback(() => {
    setRegisterSuggestionOpen(false);
  }, []);

  const handleSuggestionCreated = useCallback(() => {
    setRegisterSuggestionOpen(false);
    void loadSuggestions();
  }, [loadSuggestions]);

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
      setMinutesError(error instanceof Error ? error.message : 'Não foi possível abrir o PDF.');
    } finally {
      setLoadingPdfId(null);
    }
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

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
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
            >
              <MaterialIcons
                name={tab.icon}
                size={16}
                color={selected ? ADMINISTRATIVO_CLASS_ICON_COLOR : VIGILANCE_SCALES_UI.accent}
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
          <View style={styles.atasBody}>
            <FontAwesome name="file-text-o" size={28} color={ADMINISTRATIVO_CLASS_ICON_COLOR} />
            <Text style={styles.bodyTitle}>Atos Constitutivos</Text>
            <Text style={styles.bodyHint}>
              Consulte os PDFs publicados pelo financeiro. Toque no botão abaixo para abrir a lista.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleOpenAtasModal}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ver documentos publicados"
            >
              <Text style={styles.primaryButtonText}>Ver documentos publicados</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.suggestionsScroll}
            contentContainerStyle={styles.suggestionsContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
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
                <MaterialIcons
                  name="add-circle-outline"
                  size={16}
                  color={ADMINISTRATIVO_CLASS_ICON_COLOR}
                />
                <Text style={styles.registerSuggestionButtonText}>Registrar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.bodyHint}>
              Solicitações registradas no relatório de Sugestões e Melhorias.
            </Text>

            {loadingSuggestions ? (
              <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} style={styles.inlineLoader} />
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
                    style={[styles.suggestionCard, isCompleted && styles.suggestionCardCompleted]}
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
                      <Text style={styles.suggestionCompletedHint}>Toque para ver a ação tomada</Text>
                    ) : null}
                  </CardWrapper>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      <TouchableOpacity
        style={styles.rdButton}
        onPress={onPressRd}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={rdButtonLabel}
      >
        <Text style={styles.rdButtonText}>{rdButtonLabel}</Text>
      </TouchableOpacity>

      <Modal
        visible={minutesModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMinutesModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setMinutesModalOpen(false)} />

          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Atos Constitutivos</Text>
            <Text style={styles.modalHelp}>Selecione um arquivo para visualizar o PDF na tela.</Text>

            {minutesError ? <Text style={styles.errorText}>{minutesError}</Text> : null}

            {loadingMinutes ? (
              <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} style={styles.inlineLoader} />
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
                        <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="small" />
                      ) : (
                        <FontAwesome name="file-pdf-o" size={18} color={ADMINISTRATIVO_CLASS_ICON_COLOR} />
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
        visible={registerSuggestionOpen}
        animationType="slide"
        onRequestClose={handleCloseRegisterSuggestion}
      >
        <SafeAreaView style={styles.registerSuggestionModal} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.registerSuggestionHeader}>
            <Text style={styles.registerSuggestionTitle}>Nova sugestão ou melhoria</Text>
            <TouchableOpacity
              accessibilityLabel="Fechar formulário de sugestão"
              accessibilityRole="button"
              onPress={handleCloseRegisterSuggestion}
              style={styles.registerSuggestionCloseButton}
              activeOpacity={0.85}
            >
              <MaterialIcons name="close" size={22} color={MINIMAL_UI.icon} />
            </TouchableOpacity>
          </View>
          <View style={styles.registerSuggestionBody}>
            <MaintenanceSupportSuggestionsCard
              isActive={registerSuggestionOpen}
              panelHeight={panelHeight}
              initialMode="new"
              returnOnCreate
              variant="vigilance"
              fillContainer
              hidePanelHeader
              onNavigateBack={handleCloseRegisterSuggestion}
              onRequestCreated={handleSuggestionCreated}
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={completedActionModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletedActionModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCompletedActionModal(null)} />

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
              <Text style={styles.actionTakenText}>{completedActionModal?.action ?? '—'}</Text>
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
  root: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    gap: 12,
    paddingTop: 4,
    minHeight: 0,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  description: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.92,
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
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  tabChipSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: ADMINISTRATIVO_CLASS_ICON_COLOR,
  },
  tabChipText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  tabChipTextSelected: {
    color: ADMINISTRATIVO_CLASS_ICON_COLOR,
  },
  bodyCard: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    padding: 16,
    gap: 8,
  },
  atasBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bodyTitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyHint: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    opacity: 0.88,
  },
  primaryButton: {
    alignSelf: 'center',
    marginTop: 8,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMINISTRATIVO_CLASS_ICON_COLOR,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  primaryButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
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
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  registerSuggestionButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
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
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    padding: 10,
    gap: 4,
  },
  suggestionCardCompleted: {
    borderColor: ADMINISTRATIVO_CLASS_ICON_COLOR,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  suggestionType: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  suggestionStatus: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.88,
  },
  suggestionStatusCompleted: {
    color: ADMINISTRATIVO_CLASS_ICON_COLOR,
    opacity: 1,
  },
  suggestionCompletedHint: {
    color: ADMINISTRATIVO_CLASS_ICON_COLOR,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  suggestionMeta: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 11,
    opacity: 0.82,
  },
  suggestionTheme: {
    color: ADMINISTRATIVO_CLASS_ICON_COLOR,
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionDescription: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    lineHeight: 17,
  },
  inlineLoader: {
    paddingVertical: 12,
  },
  errorText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  emptyText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingVertical: 12,
    opacity: 0.82,
  },
  rdButton: {
    alignSelf: 'stretch',
    flexShrink: 0,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  rdButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  registerSuggestionModal: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  registerSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  registerSuggestionTitle: {
    flex: 1,
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '700',
    paddingRight: 12,
  },
  registerSuggestionCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  registerSuggestionBody: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    padding: 16,
    gap: 10,
    zIndex: 2,
  },
  modalTitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalHelp: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    opacity: 0.88,
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
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    padding: 12,
  },
  minuteMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  minuteTitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  minuteMeta: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 11,
    opacity: 0.82,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  actionTakenScroll: {
    maxHeight: 220,
  },
  actionTakenContent: {
    paddingVertical: 4,
  },
  actionTakenText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    lineHeight: 19,
  },
});
