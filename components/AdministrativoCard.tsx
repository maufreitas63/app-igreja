import { CloseButton } from '@/components/minimal/CloseFooterBar';
import { AssemblyMinutesPdfModal } from '@/components/AssemblyMinutesPdfModal';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  createAssemblyMinuteSignedUrl,
  fetchAssemblyMinutes,
  normalizeAssemblyMinuteLabel,
  type AssemblyMinuteRecord,
} from '@/lib/assemblyMinutesApi';
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
  type ViewStyle,
} from 'react-native';

type TabId = 'atas' | 'outros';

type Props = {
  panelHeight: number;
  isActive?: boolean;
  initialTab?: TabId;
};

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

/** Card Administrativo (dashboard) — só Atos Constitutivos; aba de troca desabilitada. */
export function AdministrativoCard({ panelHeight, isActive = true, initialTab: _initialTab }: Props) {
  void isActive;
  void _initialTab;

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

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
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Administrativo</Text>
      <Text style={styles.subtitle}>Documentos administrativos e atos constitutivos.</Text>

      <View style={styles.tabRow}>
        <View
          style={[
            styles.tabChip,
            styles.tabChipDisabled,
            Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as unknown as ViewStyle) : null,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: true, disabled: true }}
          accessibilityLabel="Atos Constitutivos (indisponível para troca)"
        >
          <MaterialIcons name="description" size={16} color="#94A3B8" />
          <Text style={styles.tabChipTextDisabled}>Atos Constitutivos</Text>
        </View>
      </View>

      <View style={styles.bodyCard}>
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

            <CloseButton onPress={() => setMinutesModalOpen(false)} />
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
  tabChipDisabled: {
    opacity: 0.85,
    borderColor: 'rgba(148, 163, 184, 0.55)',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
  },
  tabChipTextDisabled: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
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
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 1,
    borderColor: '#60A5FA',
    backgroundColor: 'rgba(30, 58, 138, 0.45)',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
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
    borderColor: 'rgba(96, 165, 250, 0.45)',
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
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 12,
  },
  minuteMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  minuteTitle: {
    color: '#E0F2FE',
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
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(30, 58, 138, 0.45)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '800',
  },
  inlineLoader: {
    paddingVertical: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
