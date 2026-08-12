import {
  attachMaintenanceFinancialReceipt,
  fetchRealizadoFinancialEntriesForReceiptBatch,
  type FinancialReceiptUrlsSchemaStatus,
  checkFinancialReceiptUrlsSchema,
} from '@/lib/maintenanceFinancialApi';
import { uploadFinancialAnalyticalSummaryImage } from '@/lib/financialAnalyticalSummary';
import type { FinancialEntry } from '@/lib/financialEntry';
import {
  FINANCIAL_MAX_RECEIPTS_PER_ENTRY,
  getFinancialEntryReceiptUrls,
  normalizeFinancialReceiptUrls,
} from '@/lib/financialReceiptUrls';
import {
  buildReferenciaLookup,
  entryHasRoomForReceipt,
  extractReceiptBatchDateRange,
  pickUniqueEntryForReferencia,
  runTreasuryReceiptBatchPreflight,
  slotIsOccupied,
  type TreasuryReceiptBatchPreflightIssue,
} from '@/lib/treasuryReceiptBatchPreflight';
import type { TreasuryReceiptFolderAccess } from '@/lib/treasuryReceiptFolderAccess';

export type TreasuryReceiptBatchLinkItem = {
  fileName: string;
  entryId?: string;
  label?: string;
  position?: number;
  error?: string;
  renamed?: boolean;
  renameError?: string;
  dryRun?: boolean;
};

export type TreasuryReceiptBatchSummaryItem = {
  fileName: string;
  periodCode: string;
  dryRun?: boolean;
  renamed?: boolean;
  renameError?: string;
  error?: string;
};

export type TreasuryReceiptBatchLinkReport = {
  success: boolean;
  message: string;
  dryRun: boolean;
  force: boolean;
  schemaStatus: FinancialReceiptUrlsSchemaStatus;
  folderFileCount: number;
  entriesWithReferencia: number;
  normalizedFileNames: number;
  linked: TreasuryReceiptBatchLinkItem[];
  renamedOnly: TreasuryReceiptBatchLinkItem[];
  skippedAlreadyLinked: TreasuryReceiptBatchLinkItem[];
  unmatchedFiles: TreasuryReceiptBatchLinkItem[];
  unmatchedEntries: TreasuryReceiptBatchLinkItem[];
  ambiguousReferencias: { referencia: string; entryCount: number }[];
  preflightIssues: TreasuryReceiptBatchPreflightIssue[];
  errors: TreasuryReceiptBatchLinkItem[];
  summaryReports: TreasuryReceiptBatchSummaryItem[];
  renameUnsupported: boolean;
};

export type TreasuryReceiptBatchProcessOptions = {
  dryRun?: boolean;
  force?: boolean;
};

const buildEntryLabel = (entry: FinancialEntry) => {
  const account = entry.account?.trim() || '—';
  const ministry = entry.ministry?.trim() || '—';

  return `${entry.transaction_date} · ${entry.transaction_kind} · ${account} · ${ministry}`;
};

const buildEmptyReport = (
  options: TreasuryReceiptBatchProcessOptions,
  schemaStatus: FinancialReceiptUrlsSchemaStatus
): TreasuryReceiptBatchLinkReport => ({
  success: false,
  message: 'Processamento não iniciado.',
  dryRun: Boolean(options.dryRun),
  force: Boolean(options.force),
  schemaStatus,
  folderFileCount: 0,
  entriesWithReferencia: 0,
  normalizedFileNames: 0,
  linked: [],
  renamedOnly: [],
  skippedAlreadyLinked: [],
  unmatchedFiles: [],
  unmatchedEntries: [],
  ambiguousReferencias: [],
  preflightIssues: [],
  errors: [],
  summaryReports: [],
  renameUnsupported: false,
});

const finalizeReportMessage = (report: TreasuryReceiptBatchLinkReport) => {
  const linkedCount = report.linked.length;
  const renamedOnlyCount = report.renamedOnly.length;
  const summaryCount = report.summaryReports.filter((item) => !item.error).length;
  const warningCount = report.linked.filter((item) => item.renameError).length;

  if (report.preflightIssues.length) {
    report.success = false;
    report.message = `Pré-voo falhou: ${report.preflightIssues.length} problema(s) encontrado(s).`;
    return;
  }

  if (
    linkedCount === 0 &&
    renamedOnlyCount === 0 &&
    summaryCount === 0 &&
    report.errors.length === 0 &&
    report.skippedAlreadyLinked.length === 0 &&
    report.summaryReports.every((item) => !item.error)
  ) {
    const noSummaryHint =
      report.summaryReports.length === 0
        ? ' Nenhum “AAAAMM Resumo Financeiro.jpg” (nem updated_) encontrado na pasta selecionada.'
        : '';
    report.message = report.dryRun
      ? `Simulação concluída: nenhum comprovante novo seria vinculado.${noSummaryHint}`
      : `Nenhum comprovante novo foi vinculado.${noSummaryHint}`;
    report.success = report.errors.length === 0 && report.summaryReports.every((item) => !item.error);
    return;
  }

  const parts: string[] = [];

  if (report.dryRun) {
    parts.push('Simulação');
  }

  if (linkedCount > 0) {
    parts.push(`${linkedCount} ${report.dryRun ? 'simulado(s)' : 'vinculado(s)'}`);
  }

  if (renamedOnlyCount > 0) {
    parts.push(`${renamedOnlyCount} ${report.dryRun ? 'a renomear' : 'renomeado(s)'} (já anexados)`);
  }

  if (summaryCount > 0) {
    parts.push(
      `${summaryCount} Resumo Financeiro ${report.dryRun ? 'a carregar' : 'carregado(s)'}`
    );
  }

  if (report.errors.length > 0) {
    parts.push(`${report.errors.length} erro(s)`);
  }

  if (warningCount > 0) {
    parts.push(`${warningCount} aviso(s) de rename`);
  }

  report.message = parts.length ? `${parts.join(' · ')}.` : 'Processamento concluído.';
  report.success =
    report.errors.length === 0 &&
    warningCount === 0 &&
    report.summaryReports.every((item) => !item.error);
};

export async function processTreasuryReceiptBatchFromFolder(
  folderAccess: TreasuryReceiptFolderAccess,
  options: TreasuryReceiptBatchProcessOptions = {}
): Promise<TreasuryReceiptBatchLinkReport> {
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const summaryFiles = folderAccess.summaryFiles ?? [];
  const schemaStatus = await checkFinancialReceiptUrlsSchema();

  // Resumos mensais não dependem do schema de receipt_urls — processa antes.
  const summaryOnlyReport = buildEmptyReport(options, schemaStatus);
  summaryOnlyReport.folderFileCount = folderAccess.files.length + summaryFiles.length;
  summaryOnlyReport.normalizedFileNames =
    folderAccess.files.filter((file) => file.originalFileName).length +
    summaryFiles.filter((file) => file.originalFileName).length;
  summaryOnlyReport.renameUnsupported = !folderAccess.canRenameAfterUpload;
  summaryOnlyReport.success = true;
  summaryOnlyReport.message = 'Processamento concluído.';

  for (const summaryFile of summaryFiles) {
    if (dryRun) {
      summaryOnlyReport.summaryReports.push({
        fileName: summaryFile.fileName,
        periodCode: summaryFile.periodCode,
        dryRun: true,
      });
      continue;
    }

    try {
      const dataUrl = await summaryFile.readDataUrl();
      await uploadFinancialAnalyticalSummaryImage(summaryFile.periodCode, dataUrl);

      let renamed = false;
      let renameError: string | undefined;

      if (folderAccess.canRenameAfterUpload) {
        try {
          await summaryFile.markProcessed();
          renamed = true;
        } catch (error) {
          summaryOnlyReport.renameUnsupported = true;
          renameError =
            error instanceof Error
              ? error.message
              : 'Resumo carregado, mas não foi possível renomear o arquivo local.';
        }
      }

      summaryOnlyReport.summaryReports.push({
        fileName: summaryFile.fileName,
        periodCode: summaryFile.periodCode,
        renamed,
        renameError,
      });
    } catch (error) {
      summaryOnlyReport.summaryReports.push({
        fileName: summaryFile.fileName,
        periodCode: summaryFile.periodCode,
        error:
          error instanceof Error ? error.message : 'Erro ao carregar o Resumo Financeiro.',
      });
    }
  }

  if (!schemaStatus.available) {
    if (summaryFiles.length > 0) {
      finalizeReportMessage(summaryOnlyReport);
      summaryOnlyReport.message = `${summaryOnlyReport.message} Comprovantes por referencia indisponíveis: ${schemaStatus.message}`;
      return summaryOnlyReport;
    }

    return {
      ...buildEmptyReport(options, schemaStatus),
      message: schemaStatus.message,
    };
  }

  const allEntries = await fetchRealizadoFinancialEntriesForReceiptBatch();
  const rawFileNames = folderAccess.files.map((file) => file.fileName);
  const preflight = runTreasuryReceiptBatchPreflight(rawFileNames, allEntries);
  const dateRange = preflight.dateRange ?? extractReceiptBatchDateRange(preflight.files);
  const entries = dateRange
    ? await fetchRealizadoFinancialEntriesForReceiptBatch(dateRange)
    : allEntries;
  const referenciaLookup = buildReferenciaLookup(entries);
  const receiptUrlsByEntryId = new Map<string, string[]>(
    entries.map((entry) => [entry.id, getFinancialEntryReceiptUrls(entry)])
  );
  const matchedEntryIds = new Set<string>();

  const report: TreasuryReceiptBatchLinkReport = {
    ...summaryOnlyReport,
    entriesWithReferencia: [...referenciaLookup.values()].reduce(
      (count, bucket) => count + bucket.length,
      0
    ),
    ambiguousReferencias: preflight.ambiguousReferencias.map((item) => ({
      referencia: item.referencia,
      entryCount: item.entries.length,
    })),
    preflightIssues: preflight.issues,
  };

  if (!preflight.valid) {
    if (summaryFiles.length > 0 && folderAccess.files.length === 0) {
      report.preflightIssues = [];
      finalizeReportMessage(report);
      return report;
    }

    finalizeReportMessage(report);
    return report;
  }

  const filesByName = new Map(folderAccess.files.map((file) => [file.fileName, file]));

  for (const fileInput of preflight.files) {
    const file = filesByName.get(fileInput.fileName);

    if (!file) {
      continue;
    }

    const match = pickUniqueEntryForReferencia(referenciaLookup, file.referencia);

    if (!match.entry) {
      report.unmatchedFiles.push({
        fileName: file.fileName,
        position: file.position,
      });
      continue;
    }

    const entry = match.entry;
    const label = buildEntryLabel(entry);
    const existingReceiptUrls = receiptUrlsByEntryId.get(entry.id) ?? [];
    const occupied = slotIsOccupied(existingReceiptUrls, file.position);

    if (occupied && !force) {
      matchedEntryIds.add(entry.id);

      if (dryRun) {
        report.renamedOnly.push({
          fileName: file.fileName,
          entryId: entry.id,
          label,
          position: file.position,
          dryRun: true,
        });
        continue;
      }

      try {
        if (folderAccess.canRenameAfterUpload) {
          await file.markProcessed();
          report.renamedOnly.push({
            fileName: file.fileName,
            entryId: entry.id,
            label,
            position: file.position,
            renamed: true,
          });
        } else {
          report.skippedAlreadyLinked.push({
            fileName: file.fileName,
            entryId: entry.id,
            label,
            position: file.position,
          });
        }
      } catch (error) {
        report.errors.push({
          fileName: file.fileName,
          entryId: entry.id,
          label,
          position: file.position,
          error:
            error instanceof Error
              ? error.message
              : `Posição ${file.position} já possui comprovante, mas não foi possível renomear o arquivo local.`,
        });
      }

      continue;
    }

    if (!entryHasRoomForReceipt(existingReceiptUrls, force, file.position)) {
      matchedEntryIds.add(entry.id);
      report.errors.push({
        fileName: file.fileName,
        entryId: entry.id,
        label,
        position: file.position,
        error: `Lançamento já possui ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
      });
      continue;
    }

    if (dryRun) {
      matchedEntryIds.add(entry.id);
      report.linked.push({
        fileName: file.fileName,
        entryId: entry.id,
        label,
        position: file.position,
        dryRun: true,
      });
      continue;
    }

    try {
      const dataUrl = await file.readDataUrl();
      const result = await attachMaintenanceFinancialReceipt(
        entry.id,
        dataUrl,
        existingReceiptUrls,
        file.position,
        force
      );

      if (!result.success) {
        report.errors.push({
          fileName: file.fileName,
          entryId: entry.id,
          label,
          position: file.position,
          error: result.message ?? 'Falha ao anexar comprovante.',
        });
        continue;
      }

      const nextUrls = normalizeFinancialReceiptUrls(
        'receipt_urls' in result ? result.receipt_urls : existingReceiptUrls
      );
      receiptUrlsByEntryId.set(entry.id, nextUrls);

      let renamed = false;
      let renameError: string | undefined;

      if (folderAccess.canRenameAfterUpload) {
        try {
          await file.markProcessed();
          renamed = true;
        } catch (error) {
          report.renameUnsupported = true;
          renameError =
            error instanceof Error
              ? error.message
              : 'Comprovante anexado, mas não foi possível renomear o arquivo local.';
          report.errors.push({
            fileName: file.fileName,
            entryId: entry.id,
            label,
            position: file.position,
            error: renameError,
          });
        }
      }

      matchedEntryIds.add(entry.id);
      report.linked.push({
        fileName: file.fileName,
        entryId: entry.id,
        label,
        position: file.position,
        renamed,
        renameError,
      });
    } catch (error) {
      report.errors.push({
        fileName: file.fileName,
        entryId: entry.id,
        label,
        position: file.position,
        error: error instanceof Error ? error.message : 'Erro ao processar comprovante.',
      });
    }
  }

  for (const [, bucket] of referenciaLookup.entries()) {
    for (const entry of bucket) {
      const urls = receiptUrlsByEntryId.get(entry.id) ?? [];

      if (urls.length > 0 || matchedEntryIds.has(entry.id)) {
        continue;
      }

      report.unmatchedEntries.push({
        fileName: entry.referencia?.trim() || '—',
        entryId: entry.id,
        label: buildEntryLabel(entry),
      });
    }
  }

  finalizeReportMessage(report);

  return report;
}
