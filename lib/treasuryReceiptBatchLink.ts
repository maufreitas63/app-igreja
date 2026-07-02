import {
  attachMaintenanceFinancialReceipt,
  fetchRealizadoFinancialEntriesForReceiptBatch,
} from '@/lib/maintenanceFinancialApi';
import type { FinancialEntry } from '@/lib/financialEntry';
import { isFinancialRealizado } from '@/lib/financialEntry';
import {
  FINANCIAL_MAX_RECEIPTS_PER_ENTRY,
  getFinancialEntryReceiptUrls,
  normalizeFinancialReceiptUrls,
} from '@/lib/financialReceiptUrls';
import { buildFinancialReferencia } from '@/lib/treasuryReceiptBatchPath';
import type { TreasuryReceiptFolderAccess } from '@/lib/treasuryReceiptFolderAccess';

export type TreasuryReceiptBatchLinkItem = {
  fileName: string;
  entryId?: string;
  label?: string;
  position?: number;
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

const pickEntryForReferencia = (entries: FinancialEntry[]) => entries[0] ?? null;

const slotIsOccupied = (urls: string[], position: number) => position - 1 < urls.length;

export async function processTreasuryReceiptBatchFromFolder(
  folderAccess: TreasuryReceiptFolderAccess
): Promise<TreasuryReceiptBatchLinkReport> {
  const entries = await fetchRealizadoFinancialEntriesForReceiptBatch();
  const referenciaLookup = buildReferenciaLookup(entries);
  const receiptUrlsByEntryId = new Map<string, string[]>(
    entries.map((entry) => [entry.id, getFinancialEntryReceiptUrls(entry)])
  );
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

  const sortedFiles = [...folderAccess.files].sort((left, right) => {
    const referenciaOrder = left.referencia.localeCompare(right.referencia, 'pt-BR');

    if (referenciaOrder !== 0) {
      return referenciaOrder;
    }

    return left.position - right.position;
  });

  for (const file of sortedFiles) {
    const candidates = referenciaLookup.get(file.referencia);

    if (!candidates?.length) {
      report.unmatchedFiles.push({ fileName: file.fileName, position: file.position });
      continue;
    }

    const entry = pickEntryForReferencia(candidates);

    if (!entry) {
      report.unmatchedFiles.push({ fileName: file.fileName, position: file.position });
      continue;
    }

    const label = buildEntryLabel(entry);
    const existingReceiptUrls = receiptUrlsByEntryId.get(entry.id) ?? [];

    if (slotIsOccupied(existingReceiptUrls, file.position)) {
      matchedEntryIds.add(entry.id);

      try {
        await file.markProcessed();
        report.renamedOnly.push({
          fileName: file.fileName,
          entryId: entry.id,
          label,
          position: file.position,
          renamed: true,
        });
      } catch (error) {
        report.success = false;
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

    if (existingReceiptUrls.length >= FINANCIAL_MAX_RECEIPTS_PER_ENTRY) {
      matchedEntryIds.add(entry.id);
      report.errors.push({
        fileName: file.fileName,
        entryId: entry.id,
        label,
        position: file.position,
        error: `Lançamento já possui ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
      });
      report.success = false;
      continue;
    }

    try {
      const dataUrl = await file.readDataUrl();
      const result = await attachMaintenanceFinancialReceipt(
        entry.id,
        dataUrl,
        existingReceiptUrls,
        file.position
      );

      if (!result.success) {
        report.success = false;
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
        position: file.position,
        renamed,
        renameError,
      });
    } catch (error) {
      report.success = false;
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
        fileName: entry.referencia?.trim() || buildFinancialReferencia(entry.transaction_date, entry.amount) || '—',
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
