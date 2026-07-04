import { FinancialEntryEditModal } from '@/components/FinancialEntryEditModal';
import { RDConciliationModal } from '@/components/RDConciliationModal';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import {
  FINANCIAL_BULK_CSV_FORMAT_HINT,
  formatFinancialBulkDateLabel,
} from '@/lib/maintenanceFinancialBulk';
import { formatFinancialBrl } from '@/lib/financialMonth';
import { getFinancialEntryComment, signedFinancialAmount } from '@/lib/financialEntry';
import {
  FINANCIAL_MAX_RECEIPTS_PER_ENTRY,
  getFinancialEntryReceiptUrls,
  normalizeFinancialReceiptUrls,
} from '@/lib/financialReceiptUrls';
import {
  compareFinancialMonthKeys,
  formatFinancialMonthKey,
  formatFinancialMonthLabel,
  getCalendarMonthKey,
  parseFinancialMonthKey,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import { showAppToast } from '@/lib/appToast';
import type { FinancialEntryEditDraft } from '@/lib/maintenanceFinancialEntryForm';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  createFinancialReceiptSignedUrl,
  pasteFinancialReceiptFromClipboard,
  pickFinancialReceiptFromGallery,
} from '@/lib/financialReceipt';
import { useMaintenanceFinancials } from '@/hooks/useMaintenanceFinancials';
import {
  EXPENSE_REPORT_SQL_HINT,
  EXPENSE_REPORT_RPC_MISSING,
  fetchExpenseReportsForMaintenanceMonth,
  formatExpenseReportAmount,
  formatExpenseReportDateTime,
  unreconcileExpenseReport,
  type ExpenseReportMaintenanceRow,
} from '@/lib/expenseReport';
import { toFinancialMonthReferenceDate } from '@/lib/maintenanceFinancialApi';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import type { FinancialEntry } from '@/lib/financialEntry';
import { MAINTENANCE_FINANCIALS_SQL_HINT } from '@/hooks/useMaintenanceFinancials';
import {
  DEFAULT_TREASURY_RECEIPTS_DIR,
} from '@/lib/treasuryReceiptBatchPath';
import { isTreasuryReceiptFolderAccessSupported } from '@/lib/treasuryReceiptFolderAccess';
import { AssemblyMinutesPdfModal } from '@/components/AssemblyMinutesPdfModal';
import {
  ASSEMBLY_MINUTES_SQL_HINT,
  createAssemblyMinuteSignedUrl,
  fetchAssemblyMinutes,
  normalizeAssemblyMinuteLabel,
  pickAndUploadAssemblyMinutes,
  renameAssemblyMinute,
  sortAssemblyMinutesByIbnDesc,
  type AssemblyMinuteRecord,
} from '@/lib/assemblyMinutesApi';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

const ACCENT = '#34D399';

type MaintenanceSectionKey = 'period' | 'bulk' | 'receipt_batch' | 'entries' | 'rd' | 'assembly_minutes';

type CollapsibleSectionProps = {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <View style={styles.collapseSection}>
      <TouchableOpacity
        style={styles.collapseHeader}
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.collapseHeaderTextWrap}>
          <View style={styles.collapseHeaderTitleRow}>
            <Text style={styles.collapseHeaderTitle} numberOfLines={1}>
              {title}
            </Text>
            <FontAwesome
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="#6EE7B7"
              style={styles.collapseChevron}
            />
          </View>
          {subtitle ? (
            <Text style={styles.collapseHeaderSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      {expanded ? <View style={styles.collapseBody}>{children}</View> : null}
    </View>
  );
}

export function MaintenanceFinancialsCard({ isActive = true, panelHeight }: Props) {
  const router = useRouter();
  const {
    setSelectedMonth,
    selectedMonth,
    yearOptions,
    periodLabel,
    periodSummary,
    entries,
    loading,
    importing,
    emptyingMonth,
    error,
    rpcMissing,
    parseBulkCsv,
    importBulk,
    emptyMonth,
    saveEntryComment,
    saveEntryFields,
    savingCommentEntryId,
    savingEntryId,
    attachReceipt,
    deleteReceipt,
    uploadingReceiptEntryId,
    deletingReceiptEntryId,
    canUpdateFinancials,
    bulkBudgetVersion,
    setBulkBudgetVersion,
    budgetVersionOptions,
    versionEntryCount,
    receiptsDir,
    setReceiptsDir,
    processingReceiptBatch,
    receiptBatchReport,
    processReceiptBatch,
    reload,
  } = useMaintenanceFinancials(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const formBusy = importing || emptyingMonth || savingEntryId !== null || processingReceiptBatch;

  const [csvText, setCsvText] = useState('');
  const [replacePeriod, setReplacePeriod] = useState(true);
  const [commentEditorEntry, setCommentEditorEntry] = useState<FinancialEntry | null>(null);
  const [entryEditEntry, setEntryEditEntry] = useState<FinancialEntry | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentInputActive, setCommentInputActive] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [pendingReceiptImage, setPendingReceiptImage] = useState<string | null>(null);
  const [loadingReceiptPreview, setLoadingReceiptPreview] = useState(false);
  const [showReceiptAttachOptions, setShowReceiptAttachOptions] = useState(false);
  const [receiptPreviewIndex, setReceiptPreviewIndex] = useState(0);
  const [rdConciliationOpen, setRdConciliationOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<MaintenanceSectionKey | null>(null);
  const [rdReports, setRdReports] = useState<ExpenseReportMaintenanceRow[]>([]);
  const [loadingRdReports, setLoadingRdReports] = useState(false);
  const [rdReportsError, setRdReportsError] = useState<string | null>(null);
  const [unreconcilingReportId, setUnreconcilingReportId] = useState<string | null>(null);
  const [uploadingAssemblyMinute, setUploadingAssemblyMinute] = useState(false);
  const [assemblyMinutes, setAssemblyMinutes] = useState<AssemblyMinuteRecord[]>([]);
  const [loadingAssemblyMinutes, setLoadingAssemblyMinutes] = useState(false);
  const [assemblyMinutesError, setAssemblyMinutesError] = useState<string | null>(null);
  const [assemblyPdfPreview, setAssemblyPdfPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [loadingAssemblyPdfId, setLoadingAssemblyPdfId] = useState<string | null>(null);
  const [renamingMinute, setRenamingMinute] = useState<AssemblyMinuteRecord | null>(null);
  const [renameTitleDraft, setRenameTitleDraft] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [receiptBatchDryRun, setReceiptBatchDryRun] = useState(false);
  const [receiptBatchForce, setReceiptBatchForce] = useState(false);

  const toggleSection = useCallback((section: MaintenanceSectionKey) => {
    setExpandedSection((current) => (current === section ? null : section));
  }, []);

  const loadAssemblyMinutes = useCallback(async () => {
    setLoadingAssemblyMinutes(true);
    setAssemblyMinutesError(null);

    try {
      const rows = await fetchAssemblyMinutes();
      setAssemblyMinutes(rows);
    } catch (loadError) {
      setAssemblyMinutes([]);
      setAssemblyMinutesError(
        loadError instanceof Error ? loadError.message : 'Não foi possível carregar as atas.'
      );
    } finally {
      setLoadingAssemblyMinutes(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive || expandedSection !== 'assembly_minutes') {
      return;
    }

    void loadAssemblyMinutes();
  }, [expandedSection, isActive, loadAssemblyMinutes]);

  const maintenanceMonthOptions = useMemo(() => {
    const currentMonth = getCalendarMonthKey();
    const items: FinancialMonthKey[] = [];

    for (const year of yearOptions) {
      const maxMonth =
        year < currentMonth.year ? 12 : year === currentMonth.year ? currentMonth.month : 0;

      for (let month = 1; month <= maxMonth; month += 1) {
        items.push({ year, month });
      }
    }

    return items.sort((left, right) => {
      if (left.year !== right.year) {
        return right.year - left.year;
      }

      return right.month - left.month;
    });
  }, [yearOptions]);

  const maintenanceMonthDropdownOptions = useMemo(
    () =>
      maintenanceMonthOptions.map((monthKey) => ({
        value: formatFinancialMonthKey(monthKey),
        label: formatFinancialMonthLabel(monthKey),
      })),
    [maintenanceMonthOptions]
  );

  useEffect(() => {
    const currentMonth = getCalendarMonthKey();

    if (compareFinancialMonthKeys(selectedMonth, currentMonth) > 0) {
      setSelectedMonth(currentMonth);
    }
  }, [selectedMonth, setSelectedMonth]);

  const periodSummaryLine = useMemo(() => {
    if (loading) {
      return 'Carregando lançamentos…';
    }

    return `${periodSummary.realizedCount} realizado${periodSummary.realizedCount === 1 ? '' : 's'} · ${formatFinancialBrl(periodSummary.realizedTotal)}${
      periodSummary.plannedCount > 0
        ? ` · ${periodSummary.plannedCount} planejado${periodSummary.plannedCount === 1 ? '' : 's'}`
        : ''
    }`;
  }, [loading, periodSummary]);

  const rdSummaryLine = useMemo(() => {
    if (loadingRdReports) {
      return 'Carregando relatórios do mês…';
    }

    if (!rdReports.length) {
      return 'Nenhum RD emitido neste mês';
    }

    const reconciledCount = rdReports.filter((report) => report.status === 'reconciled').length;

    return `${rdReports.length} RD${rdReports.length === 1 ? '' : 's'} · ${reconciledCount} conciliado${reconciledCount === 1 ? '' : 's'}`;
  }, [loadingRdReports, rdReports]);

  const loadRdReports = useCallback(async () => {
    setLoadingRdReports(true);
    setRdReportsError(null);

    try {
      const rows = await fetchExpenseReportsForMaintenanceMonth(
        toFinancialMonthReferenceDate(selectedMonth)
      );
      setRdReports(rows);
    } catch (err) {
      console.error('Erro ao listar RDs do mês:', err);
      setRdReports([]);

      if (err instanceof Error && err.message === EXPENSE_REPORT_RPC_MISSING) {
        setRdReportsError(EXPENSE_REPORT_SQL_HINT);
        return;
      }

      setRdReportsError('Não foi possível carregar os RDs do mês.');
    } finally {
      setLoadingRdReports(false);
    }
  }, [selectedMonth]);

  const handleEmitRdForSelectedMonth = useCallback(() => {
    router.push(
      `/expense-report?referenciaMes=${encodeURIComponent(formatFinancialMonthKey(selectedMonth))}&from=maintenance`
    );
  }, [router, selectedMonth]);

  useEffect(() => {
    if (!isActive || expandedSection !== 'rd') {
      return;
    }

    void loadRdReports();
  }, [expandedSection, isActive, loadRdReports]);

  const activeEditorEntry = useMemo(() => {
    if (!commentEditorEntry) {
      return null;
    }

    return entries.find((entry) => entry.id === commentEditorEntry.id) ?? commentEditorEntry;
  }, [commentEditorEntry, entries]);

  const receiptBusy =
    uploadingReceiptEntryId !== null || deletingReceiptEntryId !== null;
  const editorReceiptUrls = useMemo(
    () => (activeEditorEntry ? getFinancialEntryReceiptUrls(activeEditorEntry) : []),
    [activeEditorEntry]
  );
  const currentStoredReceiptUrl = editorReceiptUrls[receiptPreviewIndex] ?? null;
  const editorReceiptPreviewUri = pendingReceiptImage ?? receiptPreviewUrl;
  const hasStoredReceipts = editorReceiptUrls.length > 0;
  const hasEditorReceiptPreview = Boolean(pendingReceiptImage || hasStoredReceipts);
  const canAttachMoreReceipts =
    editorReceiptUrls.length < FINANCIAL_MAX_RECEIPTS_PER_ENTRY && !pendingReceiptImage;
  const canSaveCommentEditor = Boolean(pendingReceiptImage || commentDraft.trim());

  const bulkPreview = useMemo(() => {
    if (!csvText.trim()) {
      return null;
    }

    return parseBulkCsv(csvText);
  }, [csvText, parseBulkCsv]);

  const handlePasteClipboard = async () => {
    const clipboardText = await Clipboard.getStringAsync();

    if (!clipboardText.trim()) {
      Toast.show({
        type: 'info',
        text1: 'Financeiro',
        text2: 'Área de transferência vazia.',
        visibilityTime: 2500,
      });
      return;
    }

    setCsvText(clipboardText);
  };

  const handleImportBulk = async () => {
    if (!csvText.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Financeiro',
        text2: 'Cole ou digite o conteúdo do arquivo CSV antes de importar.',
        visibilityTime: 4000,
      });
      return;
    }

    const preview = parseBulkCsv(csvText);

    if (!preview.validRows.length) {
      Toast.show({
        type: 'error',
        text1: 'Financeiro',
        text2: preview.errors[0]?.message ?? 'Nenhuma linha válida no CSV.',
        visibilityTime: 4500,
      });
      return;
    }

    const confirmed = await confirmDialog(
      'Carga em lote',
      `${replacePeriod ? `Limpar a versão ${bulkBudgetVersion} e importar` : 'Importar'} ${preview.validRows.length} lançamento(s) para ${periodLabel}?${
        preview.errors.length ? ` (${preview.errors.length} linha(s) com erro no arquivo.)` : ''
      }`,
      replacePeriod ? 'Substituir e importar' : 'Acrescentar',
      'Cancelar',
      { destructive: replacePeriod }
    );

    if (!confirmed) {
      return;
    }

    const result = await importBulk(csvText, replacePeriod);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Financeiro',
      text2: result.message,
      visibilityTime: result.success ? 4000 : 5000,
    });

    if (result.success) {
      setCsvText('');
    }
  };

  const loadReceiptPreview = useCallback(async (receiptUrl: string | null | undefined) => {
    setReceiptPreviewUrl(null);

    if (!receiptUrl?.trim()) {
      return;
    }

    setLoadingReceiptPreview(true);

    try {
      const signedUrl = await createFinancialReceiptSignedUrl(receiptUrl);
      setReceiptPreviewUrl(signedUrl);
    } catch (err) {
      console.error('Erro ao gerar URL do comprovante:', err);
    } finally {
      setLoadingReceiptPreview(false);
    }
  }, []);

  const openEntryEditor = (entry: FinancialEntry) => {
    setEntryEditEntry(entry);
  };

  const closeEntryEditor = () => {
    setEntryEditEntry(null);
  };

  const handleSaveEntryFields = async (entryId: string, draft: FinancialEntryEditDraft) => {
    const result = await saveEntryFields(entryId, draft);

    showAppToast({
      type: result.success ? 'success' : 'error',
      text1: 'Financeiro',
      text2: result.message,
    });

    if (result.success) {
      closeEntryEditor();
    }
  };

  const openCommentEditor = (entry: FinancialEntry) => {
    setCommentEditorEntry(entry);
    setCommentDraft(getFinancialEntryComment(entry) ?? '');
    setCommentInputActive(false);
    setPendingReceiptImage(null);
    setReceiptPreviewIndex(0);
    const receiptUrls = getFinancialEntryReceiptUrls(entry);
    void loadReceiptPreview(receiptUrls[0] ?? null);
  };

  const activateCommentInput = () => {
    setCommentInputActive(true);
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  };

  const closeCommentEditor = () => {
    setCommentEditorEntry(null);
    setCommentDraft('');
    setCommentInputActive(false);
    setReceiptPreviewUrl(null);
    setPendingReceiptImage(null);
    setLoadingReceiptPreview(false);
    setShowReceiptAttachOptions(false);
    setRdConciliationOpen(false);
    setReceiptPreviewIndex(0);
  };

  const syncEditorEntry = (entryId: string, patch: Partial<FinancialEntry>) => {
    setCommentEditorEntry((current) =>
      current?.id === entryId ? { ...current, ...patch } : current
    );
  };

  useEffect(() => {
    if (!commentEditorEntry || pendingReceiptImage) {
      return;
    }

    const urls = getFinancialEntryReceiptUrls(activeEditorEntry ?? commentEditorEntry);

    if (!urls.length) {
      setReceiptPreviewUrl(null);
      return;
    }

    const safeIndex = Math.min(receiptPreviewIndex, urls.length - 1);

    if (safeIndex !== receiptPreviewIndex) {
      setReceiptPreviewIndex(safeIndex);
      return;
    }

    void loadReceiptPreview(urls[safeIndex] ?? null);
  }, [
    activeEditorEntry,
    commentEditorEntry,
    loadReceiptPreview,
    pendingReceiptImage,
    receiptPreviewIndex,
  ]);

  const handleAttachReceiptFromClipboard = async () => {
    if (!activeEditorEntry) {
      return;
    }

    if (!canAttachMoreReceipts) {
      Toast.show({
        type: 'info',
        text1: 'Comprovante',
        text2: `Cada lançamento aceita no máximo ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
        visibilityTime: 3500,
      });
      return;
    }

    try {
      const imageInput = await pasteFinancialReceiptFromClipboard();

      if (!imageInput) {
        Toast.show({
          type: 'info',
          text1: 'Comprovante',
          text2: 'Nenhuma imagem encontrada na área de transferência.',
          visibilityTime: 3000,
        });
        return;
      }

      setPendingReceiptImage(imageInput);
      setShowReceiptAttachOptions(false);
      Toast.show({
        type: 'info',
        text1: 'Comprovante',
        text2: 'Imagem selecionada. Toque em Salvar para gravar o comprovante.',
        visibilityTime: 3000,
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Comprovante',
        text2: err instanceof Error ? err.message : 'Não foi possível colar a imagem.',
        visibilityTime: 4500,
      });
    }
  };

  const handleAttachReceiptFromGallery = async () => {
    if (!activeEditorEntry) {
      return;
    }

    if (!canAttachMoreReceipts) {
      Toast.show({
        type: 'info',
        text1: 'Comprovante',
        text2: `Cada lançamento aceita no máximo ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
        visibilityTime: 3500,
      });
      return;
    }

    try {
      const imageInput = await pickFinancialReceiptFromGallery();

      if (!imageInput) {
        return;
      }

      setPendingReceiptImage(imageInput);
      setShowReceiptAttachOptions(false);
      Toast.show({
        type: 'info',
        text1: 'Comprovante',
        text2: 'Imagem selecionada. Toque em Salvar para gravar o comprovante.',
        visibilityTime: 3000,
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Comprovante',
        text2: err instanceof Error ? err.message : 'Não foi possível selecionar a imagem.',
        visibilityTime: 4500,
      });
    }
  };

  const handleViewReceipt = async () => {
    if (pendingReceiptImage) {
      try {
        await Linking.openURL(pendingReceiptImage);
      } catch (err) {
        Toast.show({
          type: 'error',
          text1: 'Comprovante',
          text2: err instanceof Error ? err.message : 'Não foi possível visualizar o comprovante.',
          visibilityTime: 4500,
        });
      }

      return;
    }

    if (!currentStoredReceiptUrl) {
      return;
    }

    try {
      const signedUrl =
        receiptPreviewUrl ?? (await createFinancialReceiptSignedUrl(currentStoredReceiptUrl));

      if (!signedUrl) {
        throw new Error('Não foi possível abrir o comprovante.');
      }

      await Linking.openURL(signedUrl);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Comprovante',
        text2: err instanceof Error ? err.message : 'Não foi possível visualizar o comprovante.',
        visibilityTime: 4500,
      });
    }
  };

  const handleDeleteReceipt = async () => {
    if (pendingReceiptImage) {
      setPendingReceiptImage(null);
      return;
    }

    if (!activeEditorEntry || !currentStoredReceiptUrl) {
      return;
    }

    const confirmed = await confirmDialog(
      'Excluir comprovante',
      editorReceiptUrls.length > 1
        ? `Deseja remover o comprovante ${receiptPreviewIndex + 1} de ${editorReceiptUrls.length}?`
        : 'Deseja remover o comprovante deste lançamento?',
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    const result = await deleteReceipt(activeEditorEntry.id, currentStoredReceiptUrl);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Comprovante',
      text2: result.message,
      visibilityTime: result.success ? 2500 : 4500,
    });

    if (result.success) {
      const nextUrls = editorReceiptUrls.filter((url) => url !== currentStoredReceiptUrl);
      syncEditorEntry(activeEditorEntry.id, {
        receipt_urls: nextUrls,
        receipt_url: nextUrls[0] ?? null,
      });
      setReceiptPreviewIndex((current) => Math.max(0, Math.min(current, nextUrls.length - 1)));
      setReceiptPreviewUrl(null);
    }
  };

  const handleSaveComment = async () => {
    if (!commentEditorEntry || !activeEditorEntry) {
      return;
    }

    let receiptSaved = false;

    if (pendingReceiptImage) {
      const receiptResult = await attachReceipt(commentEditorEntry.id, pendingReceiptImage);

      if (!receiptResult.success) {
        Toast.show({
          type: 'error',
          text1: 'Comprovante',
          text2: receiptResult.message,
          visibilityTime: 4500,
        });
        return;
      }

      if ('receipt_urls' in receiptResult) {
        const nextUrls = normalizeFinancialReceiptUrls(receiptResult.receipt_urls);
        syncEditorEntry(commentEditorEntry.id, {
          receipt_urls: nextUrls,
          receipt_url: nextUrls[0] ?? null,
        });
        setPendingReceiptImage(null);
        setReceiptPreviewIndex(nextUrls.length - 1);
        await loadReceiptPreview(nextUrls[nextUrls.length - 1] ?? null);
      } else if ('receipt_url' in receiptResult) {
        const nextUrls = receiptResult.receipt_url ? [receiptResult.receipt_url] : [];
        syncEditorEntry(commentEditorEntry.id, {
          receipt_urls: nextUrls,
          receipt_url: nextUrls[0] ?? null,
        });
        setPendingReceiptImage(null);
        setReceiptPreviewIndex(0);
        await loadReceiptPreview(nextUrls[0] ?? null);
      }

      receiptSaved = true;
    }

    const normalizedComment = commentDraft.trim() || null;
    const existingComment = getFinancialEntryComment(activeEditorEntry);
    const commentChanged = normalizedComment !== (existingComment?.trim() || null);

    if (commentChanged) {
      const result = await saveEntryComment(commentEditorEntry.id, normalizedComment);

      if (!result.success) {
        showAppToast({
          type: 'error',
          text1: 'Financeiro',
          text2: result.message,
        });
        return;
      }

      const successMessage = receiptSaved
        ? 'Comprovante e comentário salvos.'
        : result.message;

      closeCommentEditor();
      showAppToast(
        {
          type: 'success',
          text1: 'Financeiro',
          text2: successMessage,
        },
        { afterMs: 180 }
      );
      return;
    }

    if (receiptSaved) {
      closeCommentEditor();
      showAppToast(
        {
          type: 'success',
          text1: 'Financeiro',
          text2: 'Comprovante salvo.',
        },
        { afterMs: 180 }
      );
      return;
    }

    Toast.show({
      type: 'info',
      text1: 'Financeiro',
      text2: 'Nada para salvar.',
      visibilityTime: 2500,
    });
  };

  const handleDeleteComment = async () => {
    if (!commentEditorEntry) {
      return;
    }

    const confirmed = await confirmDialog(
      'Remover comentário',
      'Deseja remover o comentário deste lançamento?',
      'Remover',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    const result = await saveEntryComment(commentEditorEntry.id, null);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Financeiro',
      text2: result.message,
      visibilityTime: result.success ? 2500 : 4500,
    });

    if (result.success) {
      closeCommentEditor();
    }
  };

  const handleUnreconcileRd = async (reportId: string) => {
    const confirmed = await confirmDialog(
      'Remover conciliação',
      'Deseja remover o vínculo deste RD com o lançamento financeiro? O relatório voltará para pendente.',
      'Remover vínculo',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setUnreconcilingReportId(reportId);

    try {
      const result = await unreconcileExpenseReport(reportId);

      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'RD',
        text2: result.message,
        visibilityTime: result.success ? 3000 : 4500,
      });

      if (result.success) {
        await loadRdReports();
      }
    } finally {
      setUnreconcilingReportId(null);
    }
  };

  const handleEmptyMonth = async () => {
    const confirmed = await confirmDialog(
      'Esvaziar mês',
      `Apagar ${versionEntryCount} lançamento(s) da versão ${bulkBudgetVersion} em ${periodLabel}? As demais versões permanecem. Esta ação não pode ser desfeita.`,
      'Esvaziar mês',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    const result = await emptyMonth();

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Financeiro',
      text2: result.message,
      visibilityTime: result.success ? 3000 : 4500,
    });
  };

  const handleProcessReceiptBatch = async () => {
    const modeLabel = receiptBatchDryRun
      ? 'Simular (dry-run)'
      : receiptBatchForce
        ? 'Processar substituindo posições ocupadas'
        : 'Processar';

    const confirmed = await confirmDialog(
      receiptBatchDryRun ? 'Simular comprovantes' : 'Processar comprovantes',
      `${receiptBatchDryRun ? 'Simulação' : 'Vinculação'} de JPG/JPEG aos lançamentos REALIZADO pelo campo referencia.\n\nO navegador abrirá o seletor de pasta (Chrome/Edge no desktop). A pasta exibida abaixo é apenas referência visual — selecione a pasta correta no diálogo.\n\nReferência: ${receiptsDir.trim() || DEFAULT_TREASURY_RECEIPTS_DIR}${receiptBatchForce ? '\n\nSubstituir: comprovantes existentes na mesma posição serão trocados.' : ''}${receiptBatchDryRun ? '\n\nNenhum arquivo será enviado nem renomeado.' : '\n\nArquivos vinculados serão renomeados com updated_ após sucesso.'}`,
      modeLabel,
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    const result = await processReceiptBatch(receiptsDir.trim() || DEFAULT_TREASURY_RECEIPTS_DIR, {
      dryRun: receiptBatchDryRun,
      force: receiptBatchForce,
    });

    if ('cancelled' in result && result.cancelled) {
      return;
    }

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Comprovantes',
      text2: result.message,
      visibilityTime: result.success ? 5000 : 6000,
    });
  };

  const formatAssemblyMinuteDate = (value: string | null | undefined) => {
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

  const handleUploadAssemblyMinute = async () => {
    setUploadingAssemblyMinute(true);

    try {
      const result = await pickAndUploadAssemblyMinutes();

      if (!result) {
        return;
      }

      const { uploaded, failures } = result;

      if (uploaded.length > 0) {
        await loadAssemblyMinutes();
      }

      if (uploaded.length > 0 && failures.length === 0) {
        Toast.show({
          type: 'success',
          text1: uploaded.length === 1 ? 'Ata publicada' : 'Atas publicadas',
          text2:
            uploaded.length === 1
              ? `"${uploaded[0].title}" já pode ser consultada abaixo e no card Administrativo.`
              : `${uploaded.length} PDFs publicados. Títulos = nomes dos arquivos.`,
          visibilityTime: 4500,
        });
        return;
      }

      if (uploaded.length > 0 && failures.length > 0) {
        Toast.show({
          type: 'error',
          text1: 'Publicação parcial',
          text2: `${uploaded.length} enviada(s), ${failures.length} falha(s). Ex.: ${failures[0].fileName}`,
          visibilityTime: 7000,
        });
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Ata de assembleia',
        text2:
          failures[0]?.error.includes('assembly-minutes')
            ? ASSEMBLY_MINUTES_SQL_HINT
            : failures[0]?.error || 'Não foi possível enviar os PDFs.',
        visibilityTime: 6000,
      });
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar o PDF.';
      Toast.show({
        type: 'error',
        text1: 'Ata de assembleia',
        text2: message.includes('assembly-minutes') ? ASSEMBLY_MINUTES_SQL_HINT : message,
        visibilityTime: 6000,
      });
    } finally {
      setUploadingAssemblyMinute(false);
    }
  };

  const handleOpenAssemblyMinutePdf = async (minute: AssemblyMinuteRecord) => {
    setLoadingAssemblyPdfId(minute.id);

    try {
      const url = minute.signedUrl ?? (await createAssemblyMinuteSignedUrl(minute.storage_path));

      if (!url) {
        throw new Error('Não foi possível gerar o link de visualização do PDF.');
      }

      setAssemblyPdfPreview({ title: minute.title, url });
    } catch (openError) {
      Toast.show({
        type: 'error',
        text1: 'Ata de assembleia',
        text2:
          openError instanceof Error ? openError.message : 'Não foi possível abrir o PDF.',
        visibilityTime: 5000,
      });
    } finally {
      setLoadingAssemblyPdfId(null);
    }
  };

  const handleOpenRenameAssemblyMinute = (minute: AssemblyMinuteRecord) => {
    setRenamingMinute(minute);
    setRenameTitleDraft(normalizeAssemblyMinuteLabel(minute.title));
  };

  const handleSaveRenameAssemblyMinute = async () => {
    if (!renamingMinute) {
      return;
    }

    const nextTitle = renameTitleDraft.trim();

    if (!nextTitle) {
      Toast.show({
        type: 'error',
        text1: 'Renomear ata',
        text2: 'Informe o novo título.',
      });
      return;
    }

    setSavingRename(true);

    try {
      const updated = await renameAssemblyMinute(renamingMinute.id, nextTitle);
      setAssemblyMinutes((current) =>
        sortAssemblyMinutesByIbnDesc(
          current.map((row) => (row.id === updated.id ? { ...row, title: updated.title } : row))
        )
      );
      setRenamingMinute(null);
      setRenameTitleDraft('');
      Toast.show({
        type: 'success',
        text1: 'Ata renomeada',
        text2: `Novo título: ${updated.title}`,
      });
    } catch (renameError) {
      Toast.show({
        type: 'error',
        text1: 'Renomear ata',
        text2:
          renameError instanceof Error ? renameError.message : 'Não foi possível renomear.',
        visibilityTime: 6000,
      });
    } finally {
      setSavingRename(false);
    }
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Informações Financeiras</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      {rpcMissing ? <Text style={styles.warningText}>{MAINTENANCE_FINANCIALS_SQL_HINT}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <CollapsibleSection
        title={`Mês de referência · ${periodLabel}`}
        subtitle={periodSummaryLine}
        expanded={expandedSection === 'period'}
        onToggle={() => toggleSection('period')}
      >
        <View style={styles.periodBox}>
          <Text style={styles.periodPickerLabel}>Mês</Text>
          <DropdownSelect
            options={maintenanceMonthDropdownOptions}
            selectedValue={formatFinancialMonthKey(selectedMonth)}
            onValueChange={(value) => {
              const parsed = parseFinancialMonthKey(value);

              if (parsed) {
                setSelectedMonth(parsed);
              }
            }}
            modalTitle="Selecionar mês"
            placeholder="Selecionar mês"
            style={styles.monthDropdown}
            disabled={formBusy || rpcMissing}
          />

          <Text style={styles.periodPickerLabel}>Versão para carga/limpeza</Text>
          <View style={styles.versionChipRow}>
            {budgetVersionOptions.map((version) => (
              <TouchableOpacity
                key={version}
                style={[
                  styles.versionChip,
                  bulkBudgetVersion === version && styles.versionChipActive,
                ]}
                onPress={() => setBulkBudgetVersion(version)}
                disabled={formBusy || rpcMissing}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.versionChipText,
                    bulkBudgetVersion === version && styles.versionChipTextActive,
                  ]}
                >
                  {version}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.emptyMonthButton,
              (formBusy || rpcMissing || versionEntryCount === 0) && styles.saveButtonDisabled,
            ]}
            onPress={() => void handleEmptyMonth()}
            disabled={formBusy || rpcMissing || versionEntryCount === 0}
            activeOpacity={0.85}
          >
            {emptyingMonth ? (
              <ActivityIndicator color="#FECACA" size="small" />
            ) : (
              <Text style={styles.emptyMonthButtonText}>
                Esvaziar {bulkBudgetVersion} · {periodLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </CollapsibleSection>

      <ScrollView
        style={styles.bodyScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        {...MAINTENANCE_SCROLL_PROPS}
      >
        <CollapsibleSection
          title="Carga em lote"
          subtitle={`Versão ${bulkBudgetVersion} · importar CSV para ${periodLabel}`}
          expanded={expandedSection === 'bulk'}
          onToggle={() => toggleSection('bulk')}
        >
        <View style={styles.formCard}>
          <Text style={styles.formatHint}>{FINANCIAL_BULK_CSV_FORMAT_HINT}</Text>

          <Text style={styles.periodPickerLabel}>Versão afetada na limpeza</Text>
          <View style={styles.versionChipRow}>
            {budgetVersionOptions.map((version) => (
              <TouchableOpacity
                key={version}
                style={[
                  styles.versionChip,
                  bulkBudgetVersion === version && styles.versionChipActive,
                ]}
                onPress={() => setBulkBudgetVersion(version)}
                disabled={formBusy || rpcMissing}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.versionChipText,
                    bulkBudgetVersion === version && styles.versionChipTextActive,
                  ]}
                >
                  {version}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bulkToolbar}>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => void handlePasteClipboard()}
              disabled={formBusy || rpcMissing}
              activeOpacity={0.85}
            >
              <FontAwesome name="clipboard" size={14} color="#D1FAE5" />
              <Text style={styles.toolbarButtonText}>Colar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => setCsvText('')}
              disabled={formBusy || !csvText.trim()}
              activeOpacity={0.85}
            >
              <FontAwesome name="eraser" size={14} color="#D1FAE5" />
              <Text style={styles.toolbarButtonText}>Limpar</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.csvInput}
            placeholder="Ex.: 04/05/2026;AP.MPAGO;PROJETOS;ENTRE CONTAS;ORDINÁRIO;REALIZADO;1348;observação opcional"
            placeholderTextColor="#64748B"
            value={csvText}
            onChangeText={setCsvText}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!formBusy && !rpcMissing}
          />

          {bulkPreview ? (
            <Text style={styles.previewText}>
              Prévia para {periodLabel}: {bulkPreview.validRows.length} linha(s) válida(s)
              {bulkPreview.errors.length ? ` · ${bulkPreview.errors.length} com erro` : ''}
            </Text>
          ) : null}

          {bulkPreview && bulkPreview.errors.length > 0 ? (
            <View style={styles.errorBox}>
              {bulkPreview.errors.slice(0, 4).map((item) => (
                <Text key={`${item.line}-${item.message}`} style={styles.errorLineText}>
                  Linha {item.line}: {item.message}
                </Text>
              ))}
              {bulkPreview.errors.length > 4 ? (
                <Text style={styles.errorLineText}>
                  … e mais {bulkPreview.errors.length - 4} linha(s) com erro.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.importModeRow}>
            <TouchableOpacity
              style={[styles.importModeChip, replacePeriod && styles.importModeChipActive]}
              onPress={() => setReplacePeriod(true)}
              disabled={formBusy || rpcMissing}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.importModeChipText,
                  replacePeriod && styles.importModeChipTextActive,
                ]}
              >
                Limpar versão antes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importModeChip, !replacePeriod && styles.importModeChipActive]}
              onPress={() => setReplacePeriod(false)}
              disabled={formBusy || rpcMissing}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.importModeChipText,
                  !replacePeriod && styles.importModeChipTextActive,
                ]}
              >
                Só acrescentar
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, (formBusy || rpcMissing) && styles.saveButtonDisabled]}
            onPress={() => void handleImportBulk()}
            disabled={formBusy || rpcMissing}
            activeOpacity={0.85}
          >
            {importing ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Importar para {periodLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Comprovantes em lote"
          subtitle={
            receiptBatchReport
              ? `${receiptBatchReport.linked.length} vinculado(s) · ${receiptBatchReport.renamedOnly.length} renomeado(s)`
              : 'Vincular JPG locais pelo campo referencia'
          }
          expanded={expandedSection === 'receipt_batch'}
          onToggle={() => toggleSection('receipt_batch')}
        >
          <View style={styles.formCard}>
            <Text style={styles.formatHint}>
              Selecione a pasta local no navegador (Chrome/Edge). O caminho abaixo é apenas referência
              visual. Padrões: 20260526 3825,00.jpg/.jpeg e 20260608 1500,00 2.jpg (múltiplos anexos).
              Referências ambíguas (mesma data+valor em mais de um lançamento) são bloqueadas no pré-voo.
            </Text>

            {!isTreasuryReceiptFolderAccessSupported() ? (
              <Text style={styles.warningText}>
                Use Chrome ou Edge no desktop para permitir leitura e renomeação da pasta local.
              </Text>
            ) : null}

            <Text style={styles.periodPickerLabel}>Pasta de referência (visual)</Text>
            <TextInput
              style={styles.receiptsDirInput}
              value={receiptsDir}
              onChangeText={setReceiptsDir}
              placeholder={DEFAULT_TREASURY_RECEIPTS_DIR}
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!processingReceiptBatch && !rpcMissing && canUpdateFinancials === true}
            />

            <View style={styles.importModeRow}>
              <TouchableOpacity
                style={[styles.importModeChip, receiptBatchDryRun && styles.importModeChipActive]}
                onPress={() => setReceiptBatchDryRun((current) => !current)}
                disabled={processingReceiptBatch || rpcMissing || canUpdateFinancials !== true}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.importModeChipText,
                    receiptBatchDryRun && styles.importModeChipTextActive,
                  ]}
                >
                  Simular (dry-run)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importModeChip, receiptBatchForce && styles.importModeChipActive]}
                onPress={() => setReceiptBatchForce((current) => !current)}
                disabled={processingReceiptBatch || rpcMissing || canUpdateFinancials !== true}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.importModeChipText,
                    receiptBatchForce && styles.importModeChipTextActive,
                  ]}
                >
                  Substituir ocupadas
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (processingReceiptBatch || rpcMissing || canUpdateFinancials !== true) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={() => void handleProcessReceiptBatch()}
              disabled={processingReceiptBatch || rpcMissing || canUpdateFinancials !== true}
              activeOpacity={0.85}
            >
              {processingReceiptBatch ? (
                <ActivityIndicator color="#0f172a" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Processar</Text>
              )}
            </TouchableOpacity>

            {receiptBatchReport ? (
              <View style={styles.receiptBatchReportBox}>
                <Text style={styles.previewText}>{receiptBatchReport.message}</Text>
                <Text style={styles.receiptBatchReportLine}>
                  JPG na pasta: {receiptBatchReport.folderFileCount} · Normalizados:{' '}
                  {receiptBatchReport.normalizedFileNames} · Lançamentos com referencia:{' '}
                  {receiptBatchReport.entriesWithReferencia}
                </Text>
                <Text style={styles.receiptBatchReportLine}>
                  Vinculados: {receiptBatchReport.linked.length} · Renomeados (já anexados):{' '}
                  {receiptBatchReport.renamedOnly.length} · Sem correspondência:{' '}
                  {receiptBatchReport.unmatchedFiles.length + receiptBatchReport.unmatchedEntries.length}
                  {receiptBatchReport.preflightIssues.length
                    ? ` · Pré-voo: ${receiptBatchReport.preflightIssues.length}`
                    : ''}
                  {receiptBatchReport.errors.length
                    ? ` · Erros: ${receiptBatchReport.errors.length}`
                    : ''}
                </Text>

                {receiptBatchReport.preflightIssues.slice(0, 4).map((issue) => (
                  <Text key={`preflight-${issue.fileName}-${issue.code}`} style={styles.errorLineText}>
                    [pré-voo] {issue.fileName}: {issue.message}
                  </Text>
                ))}

                {receiptBatchReport.ambiguousReferencias.slice(0, 4).map((item) => (
                  <Text key={`ambiguous-${item.referencia}`} style={styles.errorLineText}>
                    [ambiguidade] {item.referencia} · {item.entryCount} lançamentos
                  </Text>
                ))}

                {receiptBatchReport.linked.slice(0, 6).map((item) => (
                  <Text key={`${item.entryId}-${item.fileName}`} style={styles.receiptBatchReportOk}>
                    [OK] {item.fileName}
                    {item.renamed ? ' → updated_' : item.renameError ? ' (sem rename)' : ''}
                  </Text>
                ))}

                {receiptBatchReport.renamedOnly.slice(0, 6).map((item) => (
                  <Text
                    key={`renamed-${item.entryId}-${item.fileName}`}
                    style={styles.receiptBatchReportOk}
                  >
                    [rename] {item.fileName} → updated_ (já anexado)
                  </Text>
                ))}

                {receiptBatchReport.errors.slice(0, 4).map((item) => (
                  <Text key={`err-${item.fileName}-${item.entryId ?? 'x'}`} style={styles.errorLineText}>
                    [!] {item.fileName}: {item.error}
                  </Text>
                ))}

                {receiptBatchReport.unmatchedEntries.slice(0, 4).map((item) => (
                  <Text key={`missing-${item.entryId}`} style={styles.receiptBatchReportMuted}>
                    [—] Sem JPG: {item.fileName}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Atas de assembleias"
          subtitle="Publicar, visualizar e renomear PDFs do card Administrativo"
          expanded={expandedSection === 'assembly_minutes'}
          onToggle={() => toggleSection('assembly_minutes')}
        >
          <View style={styles.formCard}>
            <Text style={styles.formatHint}>
              Selecione um ou vários PDFs de uma vez. O título inicial de cada ata será o nome do
              arquivo (sem .pdf), com “_” trocado por espaço. A lista fica em ordem descendente pelo
              código IBN (ex.: IBN.003.2025 antes de IBN.001.2025) e se atualiza a cada novo envio.
            </Text>

            <TouchableOpacity
              style={[
                styles.uploadAssemblyButton,
                (uploadingAssemblyMinute || rpcMissing || canUpdateFinancials !== true) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={() => void handleUploadAssemblyMinute()}
              disabled={uploadingAssemblyMinute || rpcMissing || canUpdateFinancials !== true}
              activeOpacity={0.85}
            >
              {uploadingAssemblyMinute ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <>
                  <FontAwesome name="file-pdf-o" size={16} color="#0F172A" />
                  <Text style={styles.uploadAssemblyButtonText}>Enviar PDF da ata</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.assemblyMinutesListHeader}>
              <Text style={styles.periodPickerLabel}>Documentos publicados</Text>
              <TouchableOpacity
                onPress={() => void loadAssemblyMinutes()}
                disabled={loadingAssemblyMinutes}
                activeOpacity={0.85}
              >
                <Text style={styles.assemblyMinutesRefreshText}>
                  {loadingAssemblyMinutes ? 'Atualizando…' : 'Atualizar'}
                </Text>
              </TouchableOpacity>
            </View>

            {assemblyMinutesError ? (
              <Text style={styles.errorText}>{assemblyMinutesError}</Text>
            ) : null}

            {loadingAssemblyMinutes && assemblyMinutes.length === 0 ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
            ) : assemblyMinutes.length === 0 ? (
              <Text style={styles.hintText}>Nenhuma ata publicada ainda.</Text>
            ) : (
              <View style={styles.assemblyMinutesList}>
                {assemblyMinutes.map((minute) => (
                  <View key={minute.id} style={styles.assemblyMinuteRow}>
                    <View style={styles.assemblyMinuteMain}>
                      <Text style={styles.assemblyMinuteTitle} numberOfLines={2}>
                        {minute.title}
                      </Text>
                      <Text style={styles.assemblyMinuteMeta}>
                        {formatAssemblyMinuteDate(minute.created_at)} ·{' '}
                        {normalizeAssemblyMinuteLabel(minute.file_name.replace(/\.pdf$/i, ''))}
                        .pdf
                      </Text>
                    </View>
                    <View style={styles.assemblyMinuteActions}>
                      <TouchableOpacity
                        style={styles.assemblyMinuteActionButton}
                        onPress={() => handleOpenRenameAssemblyMinute(minute)}
                        disabled={canUpdateFinancials !== true || savingRename}
                        activeOpacity={0.85}
                        accessibilityLabel={`Renomear ${minute.title}`}
                      >
                        <FontAwesome name="pencil" size={14} color="#A7F3D0" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.assemblyMinuteActionButton}
                        onPress={() => void handleOpenAssemblyMinutePdf(minute)}
                        disabled={loadingAssemblyPdfId === minute.id}
                        activeOpacity={0.85}
                        accessibilityLabel={`Visualizar ${minute.title}`}
                      >
                        {loadingAssemblyPdfId === minute.id ? (
                          <ActivityIndicator color="#F87171" size="small" />
                        ) : (
                          <FontAwesome name="file-pdf-o" size={16} color="#F87171" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title={`Lançamentos · ${periodLabel}`}
          subtitle={periodSummaryLine}
          expanded={expandedSection === 'entries'}
          onToggle={() => toggleSection('entries')}
        >
        {loading ? (
          <CardLoadingState lines={3} compact />
        ) : entries.length ? (
          entries.map((entry, index) => {
            const signed = signedFinancialAmount(entry);
            const entryComment = getFinancialEntryComment(entry);
            const hasReceipt = getFinancialEntryReceiptUrls(entry).length > 0;
            const linkedExpenseReportId = entry.expense_report_id?.trim() || null;
            const linkedExpenseReportNumber = entry.expense_report_number?.trim() || null;
            const isSavingThisComment = savingCommentEntryId === entry.id;
            const isSavingThisEntry = savingEntryId === entry.id;

            return (
              <View
                key={entry.id}
                style={[styles.listRow, index % 2 === 1 && styles.listRowAlt]}
              >
                <View style={styles.listMain}>
                  <Text style={styles.listTitle} numberOfLines={2}>
                    {entry.transaction_kind} · {formatFinancialBulkDateLabel(entry.transaction_date)} ·{' '}
                    {entry.account} · {entry.movement} · {entry.ministry}
                  </Text>
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {entry.budget_version}
                  </Text>
                  <Text
                    style={entryComment ? styles.listComment : styles.listCommentEmpty}
                    numberOfLines={2}
                  >
                    {entryComment ? `Comentário: ${entryComment}` : 'Sem comentário'}
                  </Text>
                  <Text style={hasReceipt ? styles.listReceiptAttached : styles.listReceiptEmpty}>
                    {hasReceipt ? 'Comprovante anexado' : 'Sem comprovante'}
                  </Text>
                  {linkedExpenseReportId ? (
                    <TouchableOpacity
                      style={styles.listExpenseReportLink}
                      onPress={() =>
                        router.push(
                          `/expense-report?id=${encodeURIComponent(linkedExpenseReportId)}`
                        )
                      }
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver RD ${linkedExpenseReportNumber ?? ''}`.trim()}
                    >
                      <FontAwesome5 name="file-alt" size={12} color="#059669" solid />
                      <Text style={styles.listExpenseReportLinkText}>
                        RD {linkedExpenseReportNumber ?? 'vinculado'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text
                    style={[
                      styles.listAmount,
                      signed < 0 ? styles.listAmountNegative : styles.listAmountPositive,
                    ]}
                  >
                    {formatFinancialBrl(signed)}
                  </Text>
                </View>
                <View style={styles.listActions}>
                  <TouchableOpacity
                    style={[
                      styles.commentButton,
                      entryComment ? styles.commentButtonFilled : styles.commentButtonEmpty,
                    ]}
                    onPress={() => openCommentEditor(entry)}
                    disabled={formBusy || rpcMissing || isSavingThisComment}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={
                      entryComment
                        ? `Editar comentário de ${entry.account}`
                        : `Adicionar comentário em ${entry.account}`
                    }
                  >
                    {isSavingThisComment ? (
                      <ActivityIndicator color="#D1FAE5" size="small" />
                    ) : (
                      <>
                        <FontAwesome
                          name={entryComment ? 'comment' : 'comment-o'}
                          size={14}
                          color={entryComment ? '#6EE7B7' : '#94A3B8'}
                        />
                        <Text
                          style={[
                            styles.commentButtonLabel,
                            entryComment && styles.commentButtonLabelFilled,
                          ]}
                        >
                          {entryComment ? 'Editar' : 'Adicionar'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {canUpdateFinancials === true ? (
                    <TouchableOpacity
                      style={styles.editEntryButton}
                      onPress={() => openEntryEditor(entry)}
                      disabled={formBusy || rpcMissing || isSavingThisEntry}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar registro de ${entry.account}`}
                    >
                      {isSavingThisEntry ? (
                        <ActivityIndicator color="#BFDBFE" size="small" />
                      ) : (
                        <>
                          <FontAwesome name="pencil" size={14} color="#BFDBFE" />
                          <Text style={styles.editEntryButtonLabel}>Editar registro</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.hintText}>Nenhum lançamento neste mês. Importe um CSV em lote.</Text>
        )}
        </CollapsibleSection>

        <CollapsibleSection
          title={`Relatórios de Despesas · ${periodLabel}`}
          subtitle={rdSummaryLine}
          expanded={expandedSection === 'rd'}
          onToggle={() => toggleSection('rd')}
        >
          <View style={styles.rdMonthFilterRow}>
            <Text style={styles.periodPickerLabel}>Mês</Text>
            <DropdownSelect
              options={maintenanceMonthDropdownOptions}
              selectedValue={formatFinancialMonthKey(selectedMonth)}
              onValueChange={(value) => {
                const parsed = parseFinancialMonthKey(value);

                if (parsed) {
                  setSelectedMonth(parsed);
                }
              }}
              modalTitle="Selecionar mês"
              placeholder="Selecionar mês"
              style={styles.rdMonthDropdown}
              disabled={formBusy || rpcMissing}
            />
            {canUpdateFinancials === true ? (
              <TouchableOpacity
                style={styles.emitRdButton}
                onPress={handleEmitRdForSelectedMonth}
                disabled={formBusy || rpcMissing}
                activeOpacity={0.85}
              >
                <FontAwesome name="plus" size={14} color="#ECFDF5" />
                <Text style={styles.emitRdButtonText}>Emitir RD</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {rdReportsError ? <Text style={styles.warningText}>{rdReportsError}</Text> : null}
          {loadingRdReports ? (
            <CardLoadingState lines={3} compact />
          ) : rdReports.length ? (
            rdReports.map((report, index) => (
              <View
                key={report.id}
                style={[styles.rdListRow, index % 2 === 1 && styles.listRowAlt]}
              >
                <View style={styles.rdListMain}>
                  <Text style={styles.rdListTitle}>{report.report_number}</Text>
                  <Text style={styles.rdListMeta} numberOfLines={1}>
                    {report.member_name} · {formatExpenseReportDateTime(report.created_at)}
                  </Text>
                  <Text style={styles.rdListMeta}>
                    {formatExpenseReportAmount(report.total_amount)} ·{' '}
                    {report.status === 'reconciled' ? 'Conciliado' : 'Pendente'}
                  </Text>
                </View>
                {report.status === 'reconciled' ? (
                  <TouchableOpacity
                    style={styles.rdUnreconcileButton}
                    onPress={() => void handleUnreconcileRd(report.id)}
                    disabled={unreconcilingReportId === report.id}
                    activeOpacity={0.85}
                  >
                    {unreconcilingReportId === report.id ? (
                      <ActivityIndicator color="#FECACA" size="small" />
                    ) : (
                      <Text style={styles.rdUnreconcileButtonText}>Remover vínculo</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.hintText}>Nenhum RD emitido neste mês de referência.</Text>
          )}
        </CollapsibleSection>
      </ScrollView>

      <Modal
        visible={commentEditorEntry !== null}
        transparent
        animationType="fade"
        onRequestClose={closeCommentEditor}
      >
        <Pressable style={styles.commentModalBackdrop} onPress={closeCommentEditor}>
          <Pressable style={styles.commentModalCard} onPress={(event) => event.stopPropagation()}>
            <ScrollView
              style={styles.commentModalScroll}
              contentContainerStyle={styles.commentModalScrollContent}
              keyboardShouldPersistTaps="handled"
              {...MAINTENANCE_SCROLL_PROPS}
            >
            <Text style={styles.commentModalTitle}>Comentários e comprovante</Text>
            {activeEditorEntry ? (
              <Text style={styles.commentModalMeta} numberOfLines={2}>
                {activeEditorEntry.account} · {activeEditorEntry.ministry} ·{' '}
                {formatFinancialBulkDateLabel(activeEditorEntry.transaction_date)}
              </Text>
            ) : null}
            <Text style={styles.commentModalFieldLabel}>Comentário / observação</Text>
            {commentInputActive || commentDraft ? (
              <TextInput
                ref={commentInputRef}
                style={styles.commentModalInput}
                placeholder="Digite a observação sobre este lançamento"
                placeholderTextColor="#64748B"
                value={commentDraft}
                onChangeText={setCommentDraft}
                multiline
                textAlignVertical="top"
                editable={savingCommentEntryId === null && !receiptBusy}
              />
            ) : (
              <Pressable
                style={styles.commentModalInputPlaceholder}
                onPress={activateCommentInput}
                disabled={savingCommentEntryId !== null || receiptBusy}
              >
                <Text style={styles.commentModalInputPlaceholderText}>
                  Toque para digitar a observação
                </Text>
              </Pressable>
            )}

            <Text style={styles.commentModalFieldLabel}>
              Comprovante
              {hasStoredReceipts && !pendingReceiptImage
                ? ` ${receiptPreviewIndex + 1}/${editorReceiptUrls.length}`
                : pendingReceiptImage
                  ? ` ${editorReceiptUrls.length + 1}/${FINANCIAL_MAX_RECEIPTS_PER_ENTRY}`
                  : ''}
            </Text>
            {canUpdateFinancials === false ? (
              <Text style={styles.receiptPermissionHint}>
                Sem permissão para anexar ou alterar comprovantes.
              </Text>
            ) : hasEditorReceiptPreview ? (
              <View style={styles.receiptAttachedBox}>
                {loadingReceiptPreview && !pendingReceiptImage ? (
                  <ActivityIndicator color="#6EE7B7" size="small" style={styles.receiptPreviewLoader} />
                ) : editorReceiptPreviewUri ? (
                  <Image
                    source={{ uri: editorReceiptPreviewUri }}
                    style={styles.receiptPreviewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.receiptAttachedText}>
                    {pendingReceiptImage
                      ? 'Comprovante selecionado (aguardando Salvar)'
                      : `Comprovante ${receiptPreviewIndex + 1} anexado`}
                  </Text>
                )}
                {hasStoredReceipts && !pendingReceiptImage && editorReceiptUrls.length > 1 ? (
                  <View style={styles.receiptEditorNavRow}>
                    <TouchableOpacity
                      style={[
                        styles.receiptEditorNavButton,
                        receiptPreviewIndex <= 0 && styles.receiptEditorNavButtonDisabled,
                      ]}
                      onPress={() => setReceiptPreviewIndex((current) => Math.max(current - 1, 0))}
                      disabled={receiptPreviewIndex <= 0 || receiptBusy}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.receiptEditorNavButtonText}>Anterior</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.receiptEditorNavButton,
                        receiptPreviewIndex >= editorReceiptUrls.length - 1 &&
                          styles.receiptEditorNavButtonDisabled,
                      ]}
                      onPress={() =>
                        setReceiptPreviewIndex((current) =>
                          Math.min(current + 1, editorReceiptUrls.length - 1)
                        )
                      }
                      disabled={receiptPreviewIndex >= editorReceiptUrls.length - 1 || receiptBusy}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.receiptEditorNavButtonText}>Próximo</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View style={styles.receiptActionRow}>
                  <TouchableOpacity
                    style={styles.receiptActionButton}
                    onPress={() => void handleViewReceipt()}
                    disabled={receiptBusy}
                    activeOpacity={0.85}
                  >
                    <FontAwesome name="eye" size={14} color="#D1FAE5" />
                    <Text style={styles.receiptActionButtonText}>Visualizar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.receiptActionButton, styles.receiptDeleteButton]}
                    onPress={() => void handleDeleteReceipt()}
                    disabled={receiptBusy || canUpdateFinancials !== true}
                    activeOpacity={0.85}
                  >
                    {deletingReceiptEntryId ? (
                      <ActivityIndicator color="#FECACA" size="small" />
                    ) : (
                      <>
                        <FontAwesome name="trash" size={14} color="#FECACA" />
                        <Text style={styles.receiptDeleteButtonText}>Excluir</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {canUpdateFinancials === true && canAttachMoreReceipts ? (
              <View
                style={[
                  styles.receiptAttachBox,
                  hasEditorReceiptPreview ? styles.receiptAttachBoxStacked : null,
                ]}
              >
                {showReceiptAttachOptions ? (
                  <>
                    <Text style={styles.receiptAttachHint}>
                      {hasStoredReceipts
                        ? 'Como deseja anexar o próximo comprovante?'
                        : 'Como deseja anexar o comprovante?'}
                    </Text>
                    <View style={styles.receiptAttachRow}>
                      <TouchableOpacity
                        style={styles.receiptAttachButton}
                        onPress={() => void handleAttachReceiptFromClipboard()}
                        disabled={receiptBusy || formBusy || rpcMissing}
                        activeOpacity={0.85}
                      >
                        {uploadingReceiptEntryId ? (
                          <ActivityIndicator color="#D1FAE5" size="small" />
                        ) : (
                          <>
                            <FontAwesome name="clipboard" size={14} color="#D1FAE5" />
                            <Text style={styles.receiptAttachButtonText}>Colar da Área de Transferência</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.receiptAttachButton}
                        onPress={() => void handleAttachReceiptFromGallery()}
                        disabled={receiptBusy || formBusy || rpcMissing}
                        activeOpacity={0.85}
                      >
                        {uploadingReceiptEntryId ? (
                          <ActivityIndicator color="#D1FAE5" size="small" />
                        ) : (
                          <>
                            <FontAwesome name="image" size={14} color="#D1FAE5" />
                            <Text style={styles.receiptAttachButtonText}>Selecionar da Galeria</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.receiptAttachCancelButton}
                      onPress={() => setShowReceiptAttachOptions(false)}
                      disabled={receiptBusy}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.receiptAttachCancelText}>Voltar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.receiptAttachPrimaryButton}
                    onPress={() => setShowReceiptAttachOptions(true)}
                    disabled={receiptBusy || formBusy || rpcMissing}
                    activeOpacity={0.85}
                  >
                    <FontAwesome name="paperclip" size={14} color="#D1FAE5" />
                    <Text style={styles.receiptAttachPrimaryButtonText}>
                      {hasStoredReceipts ? 'Adicionar outro comprovante' : 'Anexar Comprovante'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : canUpdateFinancials !== true &&
              canUpdateFinancials !== false &&
              !hasEditorReceiptPreview ? (
              <ActivityIndicator color="#6EE7B7" size="small" style={styles.receiptPreviewLoader} />
            ) : null}

            {canUpdateFinancials === true ? (
              activeEditorEntry?.expense_report_id ? (
                <TouchableOpacity
                  style={styles.linkRdButton}
                  onPress={() => {
                    const reportId = activeEditorEntry.expense_report_id?.trim();

                    if (reportId) {
                      router.push(`/expense-report?id=${encodeURIComponent(reportId)}`);
                    }
                  }}
                  disabled={!activeEditorEntry?.expense_report_id}
                  activeOpacity={0.85}
                >
                  <FontAwesome5 name="file-alt" size={14} color="#D1FAE5" solid />
                  <Text style={styles.linkRdButtonText}>
                    Ver RD {activeEditorEntry.expense_report_number ?? ''}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.linkRdButton}
                  onPress={() => setRdConciliationOpen(true)}
                  disabled={savingCommentEntryId !== null || receiptBusy || !activeEditorEntry}
                  activeOpacity={0.85}
                >
                  <FontAwesome name="link" size={14} color="#D1FAE5" />
                  <Text style={styles.linkRdButtonText}>Vincular RD</Text>
                </TouchableOpacity>
              )
            ) : null}

            <View style={styles.commentModalActions}>
              {activeEditorEntry && getFinancialEntryComment(activeEditorEntry) ? (
                <TouchableOpacity
                  style={styles.commentModalDeleteButton}
                  onPress={() => void handleDeleteComment()}
                  disabled={savingCommentEntryId !== null || receiptBusy}
                  activeOpacity={0.85}
                >
                  <Text style={styles.commentModalDeleteText}>Excluir</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.commentModalDeleteSpacer} />
              )}
              <View style={styles.commentModalPrimaryActions}>
                <TouchableOpacity
                  style={styles.commentModalCancelButton}
                  onPress={closeCommentEditor}
                  disabled={savingCommentEntryId !== null || receiptBusy}
                  activeOpacity={0.85}
                >
                  <Text style={styles.commentModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.commentModalSaveButton,
                    (savingCommentEntryId !== null || receiptBusy) && styles.saveButtonDisabled,
                  ]}
                  onPress={() => void handleSaveComment()}
                  disabled={savingCommentEntryId !== null || receiptBusy || !canSaveCommentEditor}
                  activeOpacity={0.85}
                >
                  {savingCommentEntryId ? (
                    <ActivityIndicator color="#0f172a" size="small" />
                  ) : (
                    <Text style={styles.commentModalSaveText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <FinancialEntryEditModal
        visible={entryEditEntry !== null}
        entry={entryEditEntry}
        saving={savingEntryId !== null}
        onClose={closeEntryEditor}
        onSave={(entryId, draft) => void handleSaveEntryFields(entryId, draft)}
      />

      <RDConciliationModal
        visible={rdConciliationOpen}
        financialId={activeEditorEntry?.id ?? null}
        onClose={() => setRdConciliationOpen(false)}
        onReconciled={() => {
          void loadRdReports();
          void reload();
          showAppToast(
            {
              type: 'success',
              text1: 'Financeiro',
              text2: 'RD vinculado ao lançamento.',
            },
            { afterMs: 220 }
          );
        }}
      />

      <AssemblyMinutesPdfModal
        visible={assemblyPdfPreview !== null}
        title={assemblyPdfPreview?.title ?? 'Ata'}
        pdfUrl={assemblyPdfPreview?.url ?? null}
        onClose={() => setAssemblyPdfPreview(null)}
      />

      <Modal
        visible={renamingMinute !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingRename) {
            setRenamingMinute(null);
            setRenameTitleDraft('');
          }
        }}
      >
        <Pressable
          style={styles.assemblyRenameOverlay}
          onPress={() => {
            if (!savingRename) {
              setRenamingMinute(null);
              setRenameTitleDraft('');
            }
          }}
        >
          <View style={styles.assemblyRenameCard}>
            <Text style={styles.assemblyRenameTitle}>Renomear ata</Text>
            <Text style={styles.assemblyRenameHint}>
              Arquivo: {renamingMinute?.file_name ?? '—'}
            </Text>
            <TextInput
              style={styles.assemblyRenameInput}
              value={renameTitleDraft}
              onChangeText={setRenameTitleDraft}
              placeholder="Novo título da ata"
              placeholderTextColor="#64748B"
              editable={!savingRename}
              autoFocus
            />
            <View style={styles.assemblyRenameActions}>
              <TouchableOpacity
                style={styles.assemblyRenameCancelButton}
                onPress={() => {
                  setRenamingMinute(null);
                  setRenameTitleDraft('');
                }}
                disabled={savingRename}
                activeOpacity={0.85}
              >
                <Text style={styles.assemblyRenameCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.assemblyRenameSaveButton,
                  savingRename && styles.saveButtonDisabled,
                ]}
                onPress={() => void handleSaveRenameAssemblyMinute()}
                disabled={savingRename}
                activeOpacity={0.85}
              >
                {savingRename ? (
                  <ActivityIndicator color="#0F172A" size="small" />
                ) : (
                  <Text style={styles.assemblyRenameSaveText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: 14,
    minHeight: 0,
  },
  panelTitle: {
    color: '#ECFDF5',
    fontSize: 16,
    fontWeight: '800',
  },
  panelSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  warningText: {
    color: '#FDE68A',
    fontSize: 12,
    marginBottom: 6,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 6,
  },
  collapseSection: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  collapseHeader: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
  },
  collapseHeaderTextWrap: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  collapseHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 18,
  },
  collapseHeaderTitle: {
    flex: 1,
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '800',
  },
  collapseHeaderSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 14,
  },
  collapseChevron: {
    flexShrink: 0,
  },
  collapseBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(52, 211, 153, 0.18)',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  periodBox: {
    gap: 8,
    paddingTop: 4,
  },
  periodPickerLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  monthDropdown: {
    width: '100%',
    height: 48,
  },
  rdMonthFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rdMonthDropdown: {
    flex: 1,
    minWidth: 0,
  },
  emitRdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emitRdButtonText: {
    color: '#ECFDF5',
    fontSize: 13,
    fontWeight: '700',
  },
  versionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  versionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  versionChipActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  versionChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  versionChipTextActive: {
    color: '#D1FAE5',
  },
  emptyMonthButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  emptyMonthButtonText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '800',
  },
  rdListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.12)',
  },
  rdListMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rdListTitle: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '800',
  },
  rdListMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  rdUnreconcileButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 108,
    alignItems: 'center',
  },
  rdUnreconcileButtonText: {
    color: '#FECACA',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  commentModalInputPlaceholder: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  commentModalInputPlaceholderText: {
    color: '#64748B',
    fontSize: 13,
  },
  bodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  formCard: {
    gap: 6,
    paddingTop: 4,
  },
  formatHint: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
  },
  bulkToolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  toolbarButtonText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
  },
  csvInput: {
    minHeight: 120,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    color: '#FFF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'monospace',
  },
  previewText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    borderRadius: 10,
    backgroundColor: 'rgba(127, 29, 29, 0.25)',
    padding: 8,
    gap: 2,
  },
  errorLineText: {
    color: '#FECACA',
    fontSize: 10,
    lineHeight: 13,
  },
  importModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  importModeChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  importModeChipActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  importModeChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  importModeChipTextActive: {
    color: '#D1FAE5',
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: ACCENT,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
  },
  sectionLabel: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  inlineLoader: {
    marginVertical: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.18)',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  listRowAlt: {
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  listMain: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  listMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  listComment: {
    color: '#BFDBFE',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  listCommentEmpty: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  listReceiptAttached: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '700',
  },
  listReceiptEmpty: {
    color: '#64748B',
    fontSize: 10,
    fontStyle: 'italic',
  },
  listExpenseReportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  listExpenseReportLinkText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  listActions: {
    gap: 6,
    alignItems: 'stretch',
    minWidth: 96,
    marginTop: 2,
  },
  commentButton: {
    minWidth: 72,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  editEntryButton: {
    minWidth: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(30, 58, 138, 0.28)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  editEntryButtonLabel: {
    color: '#BFDBFE',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  commentButtonEmpty: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  commentButtonFilled: {
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  commentButtonLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  commentButtonLabelFilled: {
    color: '#6EE7B7',
  },
  commentModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  commentModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#0f172a',
    maxHeight: '88%',
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
  },
  commentModalScroll: {
    maxHeight: '100%',
  },
  commentModalScrollContent: {
    padding: 14,
    gap: 10,
  },
  commentModalTitle: {
    color: '#ECFDF5',
    fontSize: 16,
    fontWeight: '800',
  },
  commentModalMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  commentModalFieldLabel: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  commentModalInput: {
    minHeight: 100,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    color: '#FFF',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  linkRdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(6, 78, 59, 0.45)',
    paddingVertical: 11,
    minHeight: 42,
  },
  linkRdButtonText: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '800',
  },
  commentModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentModalDeleteSpacer: {
    width: 72,
  },
  commentModalDeleteButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
  },
  commentModalDeleteText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '700',
  },
  commentModalPrimaryActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  commentModalCancelButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentModalCancelText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  commentModalSaveButton: {
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  commentModalSaveText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  receiptPermissionHint: {
    color: '#FDE68A',
    fontSize: 11,
  },
  receiptAttachBox: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 10,
    gap: 8,
  },
  receiptAttachBoxStacked: {
    marginTop: 8,
  },
  receiptAttachHint: {
    color: '#94A3B8',
    fontSize: 11,
  },
  receiptAttachRow: {
    flexDirection: 'row',
    gap: 8,
  },
  receiptAttachButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 42,
  },
  receiptAttachButtonText: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  receiptAttachPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(6, 78, 59, 0.45)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  receiptAttachPrimaryButtonText: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '800',
  },
  receiptAttachCancelButton: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  receiptAttachCancelText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  receiptAttachedBox: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 10,
    gap: 8,
  },
  receiptAttachedText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
  },
  receiptPreviewLoader: {
    alignSelf: 'flex-start',
  },
  receiptPreviewImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  receiptEditorNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  receiptEditorNavButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 8,
  },
  receiptEditorNavButtonDisabled: {
    opacity: 0.45,
  },
  receiptEditorNavButtonText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
  },
  receiptActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  receiptActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 10,
  },
  receiptActionButtonText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
  },
  receiptDeleteButton: {
    borderColor: 'rgba(248, 113, 113, 0.55)',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
  },
  receiptDeleteButtonText: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
  },
  listAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  listAmountPositive: {
    color: '#6EE7B7',
  },
  listAmountNegative: {
    color: '#FCA5A5',
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  assemblyMinutesListHeader: {
    marginTop: 14,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  assemblyMinutesRefreshText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
  },
  assemblyMinutesList: {
    gap: 8,
  },
  assemblyMinuteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
  },
  assemblyMinuteMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  assemblyMinuteTitle: {
    color: '#ECFDF5',
    fontSize: 13,
    fontWeight: '800',
  },
  assemblyMinuteMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  assemblyMinuteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assemblyMinuteActionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
  },
  assemblyRenameOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  assemblyRenameCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#0F172A',
    padding: 16,
    gap: 10,
  },
  assemblyRenameTitle: {
    color: '#ECFDF5',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  assemblyRenameHint: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  assemblyRenameInput: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    color: '#ECFDF5',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  assemblyRenameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  assemblyRenameCancelButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assemblyRenameCancelText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  assemblyRenameSaveButton: {
    minWidth: 96,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assemblyRenameSaveText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  uploadAssemblyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#6EE7B7',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  uploadAssemblyButtonText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  receiptsDirInput: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    color: '#ECFDF5',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'monospace',
  },
  receiptBatchReportBox: {
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.22)',
    padding: 8,
    gap: 4,
  },
  receiptBatchReportLine: {
    color: '#94A3B8',
    fontSize: 11,
  },
  receiptBatchReportOk: {
    color: '#A7F3D0',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  receiptBatchReportMuted: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
