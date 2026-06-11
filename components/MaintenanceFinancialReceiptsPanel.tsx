import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { showAppToast } from '@/lib/appToast';
import {
  getFinancialEntryComment,
  signedFinancialAmount,
  sortMaintenanceFinancialEntries,
  type FinancialEntry,
} from '@/lib/financialEntry';
import {
  FINANCIAL_MONTH_LABELS,
  formatFinancialBrl,
  formatFinancialMonthLabel,
  getCalendarMonthKey,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import { formatFinancialBulkDateLabel } from '@/lib/maintenanceFinancialBulk';
import {
  fetchMaintenanceFinancialEntries,
  toFinancialMonthReferenceDate,
} from '@/lib/maintenanceFinancialApi';
import {
  createFinancialReceiptSignedUrl,
  FINANCIAL_RECEIPT_DEFAULT_FOLDER_HINT,
  pickFinancialReceiptFromGallery,
  pickFinancialReceiptImagesFromFolder,
  type FinancialReceiptFolderImage,
} from '@/lib/financialReceipt';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  enabled: boolean;
  yearOptions: number[];
  defaultMonth: FinancialMonthKey;
  canUpdateFinancials: boolean | null;
  attachReceipt: (
    entryId: string,
    imageInput: string
  ) => Promise<{ success: boolean; message?: string }>;
  uploadingReceiptEntryId: string | null;
  rpcMissing: boolean;
  formBusy: boolean;
};

const ACCENT = '#34D399';

export function MaintenanceFinancialReceiptsPanel({
  enabled,
  yearOptions,
  defaultMonth,
  canUpdateFinancials,
  attachReceipt,
  uploadingReceiptEntryId,
  rpcMissing,
  formBusy,
}: Props) {
  const [workspaceMonth, setWorkspaceMonth] = useState<FinancialMonthKey>(defaultMonth);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [folderImages, setFolderImages] = useState<FinancialReceiptFolderImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [existingReceiptPreviewUrl, setExistingReceiptPreviewUrl] = useState<string | null>(null);
  const [loadingExistingPreview, setLoadingExistingPreview] = useState(false);

  useEffect(() => {
    setWorkspaceMonth(defaultMonth);
  }, [defaultMonth.year, defaultMonth.month]);

  const yearDropdownOptions = useMemo(
    () =>
      yearOptions.map((year) => ({
        value: String(year),
        label: String(year),
      })),
    [yearOptions]
  );

  const monthDropdownOptions = useMemo(() => {
    const currentMonth = getCalendarMonthKey();
    const maxMonth =
      workspaceMonth.year < currentMonth.year
        ? 12
        : workspaceMonth.year === currentMonth.year
          ? currentMonth.month
          : 0;

    return Array.from({ length: maxMonth }, (_, index) => {
      const month = index + 1;

      return {
        value: String(month),
        label: FINANCIAL_MONTH_LABELS[month - 1] ?? `Mês ${month}`,
      };
    });
  }, [workspaceMonth.year]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  const workspaceLabel = formatFinancialMonthLabel(workspaceMonth);

  const loadEntries = useCallback(async () => {
    if (!enabled) {
      setEntries([]);
      return;
    }

    setLoadingEntries(true);
    setEntriesError(null);

    try {
      const rows = await fetchMaintenanceFinancialEntries(
        'month',
        toFinancialMonthReferenceDate(workspaceMonth)
      );
      setEntries(sortMaintenanceFinancialEntries(rows));
    } catch (err) {
      console.error('Erro ao listar lançamentos para comprovantes:', err);
      setEntries([]);
      setEntriesError('Não foi possível carregar os lançamentos do mês.');
    } finally {
      setLoadingEntries(false);
    }
  }, [enabled, workspaceMonth]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void loadEntries();
  }, [enabled, loadEntries]);

  useEffect(() => {
    if (!selectedEntry?.receipt_url?.trim()) {
      setExistingReceiptPreviewUrl(null);
      return;
    }

    let cancelled = false;
    setLoadingExistingPreview(true);

    void createFinancialReceiptSignedUrl(selectedEntry.receipt_url)
      .then((signedUrl) => {
        if (!cancelled) {
          setExistingReceiptPreviewUrl(signedUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExistingReceiptPreviewUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingExistingPreview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEntry?.id, selectedEntry?.receipt_url]);

  const currentFolderImage = folderImages[currentImageIndex] ?? null;
  const previewUri = currentFolderImage?.dataUrl ?? existingReceiptPreviewUrl;
  const previewLabel = currentFolderImage
    ? `${currentFolderImage.name} (${currentImageIndex + 1}/${folderImages.length})`
    : selectedEntry?.receipt_url
      ? 'Comprovante já anexado'
      : 'Nenhuma imagem selecionada';

  const canAttach = Boolean(selectedEntry) && canUpdateFinancials === true && !formBusy && !rpcMissing;
  const canNavigateFolder = folderImages.length > 1;
  const isSavingSelected = uploadingReceiptEntryId === selectedEntryId;
  const canSave = canAttach && Boolean(currentFolderImage) && !isSavingSelected;

  const handleYearChange = (value: string) => {
    const year = Number.parseInt(value, 10);

    if (!Number.isFinite(year)) {
      return;
    }

    const currentMonth = getCalendarMonthKey();
    const month =
      year === currentMonth.year ? Math.min(workspaceMonth.month, currentMonth.month) : workspaceMonth.month;

    setWorkspaceMonth({ year, month: Math.max(1, month) });
    setSelectedEntryId(null);
    setFolderImages([]);
    setCurrentImageIndex(0);
  };

  const handleMonthChange = (value: string) => {
    const month = Number.parseInt(value, 10);

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return;
    }

    setWorkspaceMonth((current) => ({ ...current, month }));
    setSelectedEntryId(null);
    setFolderImages([]);
    setCurrentImageIndex(0);
  };

  const handleSelectEntry = (entry: FinancialEntry) => {
    setSelectedEntryId(entry.id);
    setFolderImages([]);
    setCurrentImageIndex(0);
  };

  const handleLoadFolder = async () => {
    if (!canAttach) {
      return;
    }

    setLoadingFolder(true);

    try {
      const images = await pickFinancialReceiptImagesFromFolder();

      if (!images.length) {
        showAppToast({
          type: 'info',
          text1: 'Comprovantes',
          text2: 'Nenhuma imagem encontrada na pasta selecionada.',
        });
        return;
      }

      setFolderImages(images);
      setCurrentImageIndex(0);

      showAppToast({
        type: 'success',
        text1: 'Comprovantes',
        text2: `${images.length} imagem(ns) carregada(s) da pasta.`,
      });
    } catch (err) {
      showAppToast({
        type: 'error',
        text1: 'Comprovantes',
        text2: err instanceof Error ? err.message : 'Não foi possível abrir a pasta.',
      });
    } finally {
      setLoadingFolder(false);
    }
  };

  const handleChangeImage = async () => {
    if (!canAttach) {
      return;
    }

    setLoadingFolder(true);

    try {
      const imageUri = await pickFinancialReceiptFromGallery();

      if (!imageUri) {
        return;
      }

      setFolderImages([{ name: 'imagem-selecionada', dataUrl: imageUri }]);
      setCurrentImageIndex(0);
    } catch (err) {
      showAppToast({
        type: 'error',
        text1: 'Comprovantes',
        text2: err instanceof Error ? err.message : 'Não foi possível selecionar a imagem.',
      });
    } finally {
      setLoadingFolder(false);
    }
  };

  const handlePreviousImage = () => {
    if (!canNavigateFolder) {
      return;
    }

    setCurrentImageIndex((current) => (current <= 0 ? folderImages.length - 1 : current - 1));
  };

  const handleNextImage = () => {
    if (!canNavigateFolder) {
      return;
    }

    setCurrentImageIndex((current) => (current >= folderImages.length - 1 ? 0 : current + 1));
  };

  const handleSaveReceipt = async () => {
    if (!selectedEntry || !currentFolderImage) {
      return;
    }

    const result = await attachReceipt(selectedEntry.id, currentFolderImage.dataUrl);

    showAppToast({
      type: result.success ? 'success' : 'error',
      text1: 'Comprovantes',
      text2: result.message ?? (result.success ? 'Comprovante gravado.' : 'Não foi possível gravar.'),
    });

    if (result.success) {
      await loadEntries();
    }
  };

  return (
    <View style={styles.workspace}>
      <View style={styles.leftColumn}>
        <Text style={styles.columnTitle}>Lançamentos · {workspaceLabel}</Text>

        <Text style={styles.fieldLabel}>Ano</Text>
        <DropdownSelect
          options={yearDropdownOptions}
          selectedValue={String(workspaceMonth.year)}
          onValueChange={handleYearChange}
          modalTitle="Selecionar ano"
          placeholder="Ano"
          style={styles.dropdown}
          disabled={formBusy || rpcMissing}
        />

        <Text style={styles.fieldLabel}>Mês</Text>
        <DropdownSelect
          options={monthDropdownOptions}
          selectedValue={String(workspaceMonth.month)}
          onValueChange={handleMonthChange}
          modalTitle="Selecionar mês"
          placeholder="Mês"
          style={styles.dropdown}
          disabled={formBusy || rpcMissing}
        />

        {entriesError ? <Text style={styles.errorText}>{entriesError}</Text> : null}

        {loadingEntries ? (
          <CardLoadingState lines={4} compact />
        ) : entries.length ? (
          <ScrollView style={styles.entryList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {entries.map((entry, index) => {
              const signed = signedFinancialAmount(entry);
              const isSelected = entry.id === selectedEntryId;
              const hasReceipt = Boolean(entry.receipt_url?.trim());

              return (
                <View
                  key={entry.id}
                  style={[styles.entryRow, index % 2 === 1 && styles.entryRowAlt, isSelected && styles.entryRowSelected]}
                >
                  <View style={styles.entryMain}>
                    <Text style={styles.entryDateValue} numberOfLines={1}>
                      {formatFinancialBulkDateLabel(entry.transaction_date)} · {formatFinancialBrl(signed)}
                    </Text>
                    <Text style={styles.entryMeta} numberOfLines={2}>
                      {entry.transaction_kind} · {entry.account} · {entry.movement} · {entry.ministry}
                    </Text>
                    <Text style={hasReceipt ? styles.entryReceiptYes : styles.entryReceiptNo}>
                      {hasReceipt ? 'Comprovante anexado' : 'Sem comprovante'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.selectButton, isSelected && styles.selectButtonActive]}
                    onPress={() => handleSelectEntry(entry)}
                    disabled={formBusy || rpcMissing}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.selectButtonText, isSelected && styles.selectButtonTextActive]}>
                      {isSelected ? 'Selecionado' : 'Selecionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.hintText}>Nenhum lançamento em {workspaceLabel}.</Text>
        )}

        <TouchableOpacity
          style={[styles.folderButton, !canAttach && styles.buttonDisabled]}
          onPress={() => void handleLoadFolder()}
          disabled={!canAttach || loadingFolder}
          activeOpacity={0.85}
        >
          {loadingFolder ? (
            <ActivityIndicator color="#D1FAE5" size="small" />
          ) : (
            <>
              <FontAwesome name="folder-open" size={14} color="#D1FAE5" />
              <Text style={styles.folderButtonText}>Buscar na pasta</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.folderHint}>
          Pasta sugerida: {FINANCIAL_RECEIPT_DEFAULT_FOLDER_HINT}
          {Platform.OS === 'web'
            ? ' (no navegador, selecione essa pasta ao abrir o seletor de arquivos).'
            : ''}
        </Text>
      </View>

      <View style={styles.rightColumn}>
        <Text style={styles.columnTitle}>Prévia do comprovante</Text>
        {selectedEntry ? (
          <Text style={styles.selectedEntryMeta} numberOfLines={2}>
            {selectedEntry.transaction_kind} · {formatFinancialBulkDateLabel(selectedEntry.transaction_date)} ·{' '}
            {selectedEntry.account}
            {getFinancialEntryComment(selectedEntry)
              ? ` · ${getFinancialEntryComment(selectedEntry)}`
              : ''}
          </Text>
        ) : (
          <Text style={styles.hintText}>Selecione um lançamento na coluna da esquerda.</Text>
        )}

        <View style={styles.previewBox}>
          {loadingExistingPreview && !currentFolderImage ? (
            <ActivityIndicator color="#6EE7B7" size="large" />
          ) : previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <Text style={styles.previewPlaceholder}>Prévia da imagem</Text>
          )}
        </View>

        <Text style={styles.previewCaption} numberOfLines={2}>
          {previewLabel}
        </Text>

        <View style={styles.previewToolbar}>
          <TouchableOpacity
            style={[styles.toolbarButton, !canNavigateFolder && styles.buttonDisabled]}
            onPress={handlePreviousImage}
            disabled={!canNavigateFolder}
            activeOpacity={0.85}
          >
            <FontAwesome name="chevron-left" size={14} color="#D1FAE5" />
            <Text style={styles.toolbarButtonText}>Anterior</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolbarButton, !canAttach && styles.buttonDisabled]}
            onPress={() => void handleChangeImage()}
            disabled={!canAttach || loadingFolder}
            activeOpacity={0.85}
          >
            <FontAwesome name="refresh" size={14} color="#D1FAE5" />
            <Text style={styles.toolbarButtonText}>Trocar imagem</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolbarButton, !canNavigateFolder && styles.buttonDisabled]}
            onPress={handleNextImage}
            disabled={!canNavigateFolder}
            activeOpacity={0.85}
          >
            <Text style={styles.toolbarButtonText}>Próxima</Text>
            <FontAwesome name="chevron-right" size={14} color="#D1FAE5" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!canSave || uploadingReceiptEntryId === selectedEntryId) && styles.buttonDisabled]}
          onPress={() => void handleSaveReceipt()}
          disabled={!canSave || uploadingReceiptEntryId === selectedEntryId}
          activeOpacity={0.85}
        >
          {uploadingReceiptEntryId === selectedEntryId ? (
            <ActivityIndicator color="#0f172a" size="small" />
          ) : (
            <>
              <FontAwesome name="save" size={14} color="#0f172a" />
              <Text style={styles.saveButtonText}>Gravar comprovante</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  workspace: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    paddingTop: 4,
  },
  leftColumn: {
    flex: Platform.OS === 'web' ? 1 : undefined,
    minWidth: Platform.OS === 'web' ? 280 : undefined,
    gap: 6,
  },
  rightColumn: {
    flex: Platform.OS === 'web' ? 1 : undefined,
    minWidth: Platform.OS === 'web' ? 280 : undefined,
    gap: 8,
  },
  columnTitle: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '800',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  dropdown: {
    width: '100%',
    height: 44,
  },
  entryList: {
    maxHeight: 280,
    marginTop: 4,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.18)',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 6,
  },
  entryRowAlt: {
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  entryRowSelected: {
    borderColor: 'rgba(52, 211, 153, 0.55)',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  entryMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  entryDateValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  entryMeta: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
  },
  entryReceiptYes: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
  },
  entryReceiptNo: {
    color: '#64748B',
    fontSize: 10,
    fontStyle: 'italic',
  },
  selectButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  selectButtonActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  selectButtonText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  selectButtonTextActive: {
    color: '#D1FAE5',
  },
  folderButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingVertical: 10,
  },
  folderButtonText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
  },
  folderHint: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
  },
  selectedEntryMeta: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  previewBox: {
    minHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  previewImage: {
    width: '100%',
    height: 220,
  },
  previewPlaceholder: {
    color: '#64748B',
    fontSize: 12,
  },
  previewCaption: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
  },
  previewToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toolbarButtonText: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '700',
  },
  saveButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: ACCENT,
    paddingVertical: 12,
  },
  saveButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  hintText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 11,
  },
});
