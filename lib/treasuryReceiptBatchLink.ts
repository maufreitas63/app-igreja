import {
  attachMaintenanceFinancialReceipt,
  fetchRealizadoFinancialEntriesForReceiptBatch,
} from '@/lib/maintenanceFinancialApi';
import type { FinancialEntry } from '@/lib/financialEntry';
import { isFinancialRealizado } from '@/lib/financialEntry';
import { buildFinancialReferencia } from '@/lib/treasuryReceiptBatchPath';
import type { TreasuryReceiptFolderAccess } from '@/lib/treasuryReceiptFolderAccess';

export type TreasuryReceiptBatchLinkItem = {
  fileName: string;
  entryId?: string;
  label?: string;
  error?: string;
  renamed?: boolean;
  renameError?: string;
};

export type TreasuryReceiptBatchLinkReport = {
  success: boolean;
  message: string;
  folderFileCount: number;
  entriesWithReferencia: number;
  normalizedFileNames: number;
  linked: TreasuryReceiptBatchLinkItem[];
  renamedOnly: TreasuryReceiptBatchLinkItem[];
  skippedAlreadyLinked: TreasuryReceiptBatchLinkItem[];
  unmatchedFiles: TreasuryReceiptBatchLinkItem[];
  unmatchedEntries: TreasuryReceiptBatchLinkItem[];
  errors: TreasuryReceiptBatchLinkItem[];
  renameUnsupported: boolean;
};

const buildEntryLabel = (entry: FinancialEntry) => {
  const account = entry.account?.trim() || '—';
  const ministry = entry.ministry?.trim() || '—';

  return `${entry.transaction_date} · ${entry.transaction_kind} · ${account} · ${ministry}`;
};

const buildReferenciaLookup = (entries: FinancialEntry[]) => {
  const lookup = new Map<string, FinancialEntry[]>();

  for (const entry of entries) {
    if (!isFinancialRealizado(entry.budget_version)) {
      continue;
    }

    const referencia =
      entry.referencia?.trim() ||
      buildFinancialReferencia(entry.transaction_date, entry.amount);

    if (!referencia) {
      continue;
    }

    const bucket = lookup.get(referencia) ?? [];
    bucket.push(entry);
    lookup.set(referencia, bucket);
  }

  return lookup;
};

const pickEntryForReferencia = (entries: FinancialEntry[]) => {
  const withoutReceipt = entries.find((entry) => !entry.receipt_url?.trim());

  return withoutReceipt ?? entries[0] ?? null;
};

export async function processTreasuryReceiptBatchFromFolder(
  folderAccess: TreasuryReceiptFolderAccess
): Promise<TreasuryReceiptBatchLinkReport> {
  const entries = await fetchRealizadoFinancialEntriesForReceiptBatch();
  const referenciaLookup = buildReferenciaLookup(entries);
  const matchedEntryIds = new Set<string>();
  const normalizedFileNames = folderAccess.files.filter((file) => file.originalFileName).length;

  const report: TreasuryReceiptBatchLinkReport = {
    success: true,
    message: 'Processamento concluído.',
    folderFileCount: folderAccess.files.length,
    entriesWithReferencia: [...referenciaLookup.values()].reduce(
      (count, bucket) => count + bucket.length,
      0
    ),
    normalizedFileNames,
    linked: [],
    renamedOnly: [],
    skippedAlreadyLinked: [],
    unmatchedFiles: [],
    unmatchedEntries: [],
    errors: [],
    renameUnsupported: !folderAccess.canRenameAfterUpload,
  };

  for (const file of folderAccess.files) {
    const candidates = referenciaLookup.get(file.fileName);

    if (!candidates?.length) {
      report.unmatchedFiles.push({ fileName: file.fileName });
      continue;
    }

    const entry = pickEntryForReferencia(candidates);

    if (!entry) {
      report.unmatchedFiles.push({ fileName: file.fileName });
      continue;
    }

    const label = buildEntryLabel(entry);

    if (entry.receipt_url?.trim()) {
      matchedEntryIds.add(entry.id);

      try {
        await file.markProcessed();
        report.renamedOnly.push({
          fileName: file.fileName,
          entryId: entry.id,
          label,
          renamed: true,
        });
      } catch (error) {
        report.success = false;
        report.errors.push({
          fileName: file.fileName,
          entryId: entry.id,
          label,
          error:
            error instanceof Error
              ? error.message
              : 'Comprovante já anexado, mas não foi possível renomear o arquivo local.',
        });
      }

      continue;
    }

    try {
      const dataUrl = await file.readDataUrl();
      const result = await attachMaintenanceFinancialReceipt(entry.id, dataUrl);

      if (!result.success) {
        report.success = false;
        report.errors.push({
          fileName: file.fileName,
          entryId: entry.id,
          label,
          error: result.message ?? 'Falha ao anexar comprovante.',
        });
        continue;
      }

      let renamed = false;
      let renameError: string | undefined;

      try {
        await file.markProcessed();
        renamed = true;
      } catch (error) {
        report.renameUnsupported = true;
        renameError =
          error instanceof Error
            ? error.message
            : 'Comprovante anexado, mas não foi possível renomear o arquivo local.';
      }

      matchedEntryIds.add(entry.id);
      report.linked.push({
        fileName: file.fileName,
        entryId: entry.id,
        label,
        renamed,
        renameError,
      });
    } catch (error) {
      report.success = false;
      report.errors.push({
        fileName: file.fileName,
        entryId: entry.id,
        label,
        error: error instanceof Error ? error.message : 'Erro ao processar comprovante.',
      });
    }
  }

  for (const [referencia, bucket] of referenciaLookup.entries()) {
    const hasPendingEntry = bucket.some(
      (entry) => !entry.receipt_url?.trim() && !matchedEntryIds.has(entry.id)
    );

    if (!hasPendingEntry) {
      continue;
    }

    for (const entry of bucket) {
      if (entry.receipt_url?.trim() || matchedEntryIds.has(entry.id)) {
        continue;
      }

      report.unmatchedEntries.push({
        fileName: referencia,
        entryId: entry.id,
        label: buildEntryLabel(entry),
      });
    }
  }

  const linkedCount = report.linked.length;
  const renamedOnlyCount = report.renamedOnly.length;

  if (
    linkedCount === 0 &&
    renamedOnlyCount === 0 &&
    report.errors.length === 0 &&
    report.skippedAlreadyLinked.length === 0
  ) {
    report.message = 'Nenhum comprovante novo foi vinculado.';
  } else {
    const parts: string[] = [];

    if (linkedCount > 0) {
      parts.push(`${linkedCount} vinculado(s)`);
    }

    if (renamedOnlyCount > 0) {
      parts.push(`${renamedOnlyCount} renomeado(s) (já anexados)`);
    }

    report.message =
      parts.length > 0 ? `${parts.join(' · ')} com sucesso.` : 'Processamento concluído.';
  }

  if (report.errors.length > 0) {
    report.success = false;
    const parts: string[] = [];

    if (linkedCount > 0) {
      parts.push(`${linkedCount} vinculado(s)`);
    }

    if (renamedOnlyCount > 0) {
      parts.push(`${renamedOnlyCount} renomeado(s)`);
    }

    parts.push(`${report.errors.length} erro(s)`);
    report.message = parts.join(' · ');
  }

  return report;
}
