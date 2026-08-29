import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { AssemblyMinutesPdfModal } from '@/components/AssemblyMinutesPdfModal';
import {
  createAssemblyMinuteSignedUrl,
  fetchAssemblyMinutes,
  normalizeAssemblyMinuteLabel,
  type AssemblyMinuteRecord,
} from '@/lib/assemblyMinutesApi';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
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
} from 'react-native';

const ADMINISTRATIVO_CLASS_SURFACE = '#FFFFFF';
const ADMINISTRATIVO_CLASS_ICON_COLOR = '#1B4F8A';

type TabId = 'atas' | 'outros';

/** Atos é a única função; “Outros” oculto e aba Atos desabilitada até existir outra. */
const ADMINISTRATIVO_TABS: {
  id: TabId;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  enabled: boolean;
}[] = [{ id: 'atas', label: 'Atos Constitutivos', icon: 'description', enabled: false }];

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
  /** Mantido por compatibilidade de rotas; ignorado até existir aba Outros. */
  initialTab?: TabId;
  onPressRd?: () => void;
  onClose?: () => void;
};

/** Visualização do módulo Administrativo — Atos Constitutivos (+ RD). */
export function AdministrativoClass({
  title = 'Administrativo',
  description = 'Documentos administrativos e atos constitutivos.',
  rdButtonLabel = 'Criar Relatório de Despesas (RD)',
  initialTab: _initialTab = 'atas',
  onPressRd,
  onClose,
}: AdministrativoClassProps) {
  void _initialTab;

  const [minutes, setMinutes] = useState<AssemblyMinuteRecord[]>([]);
  const [loadingMinutes, setLoadingMinutes] = useState(false);
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [minutesModalOpen, setMinutesModalOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; url: string } | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

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

  const handleOpenAtasModal = useCallback(() => {
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
        {ADMINISTRATIVO_TABS.map((tab) => (
          <View
            key={tab.id}
            style={[styles.tabChip, styles.tabChipSelected, styles.tabChipDisabled]}
            accessibilityRole="button"
            accessibilityState={{ selected: true, disabled: true }}
            accessibilityLabel={`${tab.label} (indisponível para troca)`}
          >
            <MaterialIcons name={tab.icon} size={16} color="#94A3B8" />
            <Text style={[styles.tabChipText, styles.tabChipTextDisabled]}>{tab.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bodyCard}>
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
      </View>

      <View style={styles.footerActionsColumn}>
        <TouchableOpacity
          style={styles.rdButton}
          onPress={onPressRd}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={rdButtonLabel}
        >
          <Text style={styles.rdButtonText}>{rdButtonLabel}</Text>
        </TouchableOpacity>
        {onClose ? <CloseFooterBar onPress={onClose} /> : null}
      </View>

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

            <CloseFooterBar onPress={() => setMinutesModalOpen(false)} />
          </View>
        </View>
      </Modal>

      <AssemblyMinutesPdfModal
        visible={pdfPreview !== null}
        title={pdfPreview?.title ?? 'Ata'}
        pdfUrl={pdfPreview?.url ?? null}
        onClose={() => setPdfPreview(null)}
      />
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
  },
  tabChipSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: ADMINISTRATIVO_CLASS_ICON_COLOR,
  },
  tabChipDisabled: {
    opacity: 0.85,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web' ? { cursor: 'not-allowed' as const } : null),
  },
  tabChipText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  tabChipTextDisabled: {
    color: '#94A3B8',
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
  footerActionsColumn: {
    gap: 10,
    flexShrink: 0,
  },
  rdButton: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
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
  closeScreenButton: {
    flexShrink: 0,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  closeScreenButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: CLOSE_FOOTER_DOCK_HEIGHT,
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
  inlineLoader: {
    paddingVertical: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
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
});
