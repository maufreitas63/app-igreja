import {
  financialBulkRowsToRpcPayload,
  parseFinancialBulkAmount,
  type FinancialBulkRow,
} from '@/lib/maintenanceFinancialBulk';
import { parseMaintenanceEventDateTimeToIso } from '@/lib/maintenanceEventForm';
import { parseRegisterScaleRpc } from '@/lib/maintenanceScales';
import { isAclStrictMode, sessionHasAccess } from '@/lib/accessControl';
import {
  deleteFinancialReceiptFile,
  uploadFinancialReceiptImage,
} from '@/lib/financialReceipt';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import {
  normalizeFinancialEntryRow,
  sortMaintenanceFinancialEntries,
  type FinancialEntry,
} from '@/lib/financialEntry';
import {
  FINANCIAL_MAX_RECEIPTS_PER_ENTRY,
  getFinancialEntryReceiptUrls,
  normalizeFinancialReceiptUrls,
  placeFinancialReceiptAtPosition,
} from '@/lib/financialReceiptUrls';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { getFinancialMonthDateRange } from '@/lib/financialMonth';

export const MAINTENANCE_FINANCIALS_SQL_HINT =
  'Execute no Supabase: scripts/financials-receipt-urls.sql (comprovantes múltiplos), scripts/financials-maintenance-rpc.sql e scripts/financials-referencia.sql.';

export const MAINTENANCE_FINANCIALS_RPC_MISSING = 'MAINTENANCE_FINANCIALS_RPC_MISSING';

export type MaintenanceFinancialPeriodMode = 'day' | 'month';

export const MAINTENANCE_FINANCIAL_TRANSACTION_KINDS = [
  'ENTRADAS',
  'SAÍDAS',
  'ENTRE CONTAS',
] as const;

export const MAINTENANCE_FINANCIAL_MOVEMENTS = ['ORDINÁRIO', 'EXTRAORDINÁRIO'] as const;

export const MAINTENANCE_FINANCIAL_BUDGET_VERSIONS = ['REALIZADO', 'PLANEJADO'] as const;

const FINANCIAL_SELECT =
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, receipt_url, receipt_urls, referencia';

const FINANCIAL_SELECT_WITHOUT_RECEIPT_URLS =
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, receipt_url, referencia';

const FINANCIAL_SELECT_WITHOUT_REFERENCIA =
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, receipt_url, receipt_urls';

const FINANCIAL_SELECT_WITHOUT_REFERENCIA_AND_RECEIPT_URLS =
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, receipt_url';

const isMissingReferenciaColumn = (message: string) =>
  message.toLowerCase().includes('referencia');

const isMissingReceiptUrlsColumn = (message: string) => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('receipt_urls') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find') ||
      normalized.includes('column'))
  );
};

export async function assertMaintenanceFinancialUpdateAccess() {
  const allowed = await sessionHasAccess('table', 'financials', 'update');

  if (!allowed) {
    return {
      success: false as const,
      message: 'Sem permissão para alterar lançamentos financeiros.',
    };
  }

  return { success: true as const };
}

const throwRpcMissing = () => {
  const schemaError = new Error(MAINTENANCE_FINANCIALS_RPC_MISSING);
  schemaError.name = 'MaintenanceFinancialsRpcMissing';
  throw schemaError;
};

export const parseFinancialDateInputToIso = (dateInput: string): string | null => {
  const iso = parseMaintenanceEventDateTimeToIso(dateInput.trim(), '12:00', '12:00');

  if (!iso) {
    return null;
  }

  return iso.slice(0, 10);
};

export const formatFinancialDateForInput = (isoDate: string) => {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return '';
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year.slice(-2)}`;
};

export const toFinancialMonthReferenceDate = ({ year, month }: FinancialMonthKey) =>
  `${year}-${String(month).padStart(2, '0')}-01`;

export const parseFinancialRows = (data: unknown): FinancialEntry[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return sortMaintenanceFinancialEntries(
    data
      .map((row) => normalizeFinancialEntryRow(row as Record<string, unknown>))
      .filter((row): row is FinancialEntry => row !== null)
  );
};

const handleRpcError = (error: { message?: string }, functionName: string) => {
  const message = (error.message ?? '').toLowerCase();

  if (isSupabaseRpcMissing(message, functionName)) {
    throwRpcMissing();
  }

  throw error;
};

export async function listMaintenanceFinancialEntries(
  periodMode: MaintenanceFinancialPeriodMode,
  referenceIsoDate: string
) {
  const { data, error } = await supabase.rpc('listar_lancamentos_financeiros_periodo', {
    p_periodo: periodMode === 'day' ? 'dia' : 'mes',
    p_referencia: referenceIsoDate,
  });

  if (error) {
    handleRpcError(error, 'listar_lancamentos_financeiros_periodo');
  }

  return parseFinancialRows(data);
}

async function listMaintenanceFinancialEntriesDirect(
  periodMode: MaintenanceFinancialPeriodMode,
  referenceIsoDate: string
) {
  const bounds =
    periodMode === 'day'
      ? { startDate: referenceIsoDate, endDate: referenceIsoDate }
      : getFinancialMonthDateRange(
          {
            year: Number(referenceIsoDate.slice(0, 4)),
            month: Number(referenceIsoDate.slice(5, 7)),
          }
        );

  const selectCandidates = [
    FINANCIAL_SELECT,
    FINANCIAL_SELECT_WITHOUT_RECEIPT_URLS,
    FINANCIAL_SELECT_WITHOUT_REFERENCIA,
    FINANCIAL_SELECT_WITHOUT_REFERENCIA_AND_RECEIPT_URLS,
  ];

  let lastError: { message?: string } | null = null;

  for (const selectColumns of selectCandidates) {
    let query = supabase
      .from('financials')
      .select(selectColumns)
      .gte('transaction_date', bounds.startDate)
      .order('transaction_kind', { ascending: true })
      .order('transaction_date', { ascending: true })
      .order('account', { ascending: true })
      .order('movement', { ascending: true })
      .order('ministry', { ascending: true });

    if (periodMode === 'day') {
      query = query.eq('transaction_date', bounds.startDate);
    } else {
      query = query.lte('transaction_date', bounds.endDate);
    }

    const { data, error } = await query;

    if (!error) {
      return parseFinancialRows(data);
    }

    lastError = error;

    const message = error.message ?? '';

    if (
      !isMissingReceiptUrlsColumn(message) &&
      !isMissingReferenciaColumn(message)
    ) {
      throw error;
    }
  }

  throw lastError ?? new Error('Não foi possível listar lançamentos financeiros.');
}

export async function fetchMaintenanceFinancialEntries(
  periodMode: MaintenanceFinancialPeriodMode,
  referenceIsoDate: string
) {
  try {
    return await listMaintenanceFinancialEntries(periodMode, referenceIsoDate);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === MAINTENANCE_FINANCIALS_RPC_MISSING) {
        if (isAclStrictMode()) {
          throw new Error(MAINTENANCE_FINANCIALS_SQL_HINT);
        }

        return listMaintenanceFinancialEntriesDirect(periodMode, referenceIsoDate);
      }

      if (isMissingReceiptUrlsColumn(err.message)) {
        return listMaintenanceFinancialEntriesDirect(periodMode, referenceIsoDate);
      }
    }

    throw err;
  }
}

const REALIZADO_RECEIPT_BATCH_PAGE_SIZE = 1000;

export type FinancialReceiptUrlsSchemaStatus = {
  available: boolean;
  message: string;
};

export async function checkFinancialReceiptUrlsSchema(): Promise<FinancialReceiptUrlsSchemaStatus> {
  const { error } = await supabase.from('financials').select('receipt_urls').limit(1);

  if (!error) {
    return { available: true, message: 'Coluna receipt_urls disponível.' };
  }

  if (isMissingReceiptUrlsColumn(error.message ?? '')) {
    return {
      available: false,
      message:
        'Execute scripts/financials-receipt-urls.sql no Supabase para habilitar múltiplos comprovantes por lançamento.',
    };
  }

  return {
    available: false,
    message: error.message ?? 'Não foi possível verificar o schema de comprovantes.',
  };
};

export async function fetchRealizadoFinancialEntriesForReceiptBatch(
  dateRange?: { minIso: string; maxIso: string } | null
) {
  const rows: FinancialEntry[] = [];
  let from = 0;
  const selectCandidates = [
    FINANCIAL_SELECT,
    FINANCIAL_SELECT_WITHOUT_RECEIPT_URLS,
    FINANCIAL_SELECT_WITHOUT_REFERENCIA,
    FINANCIAL_SELECT_WITHOUT_REFERENCIA_AND_RECEIPT_URLS,
  ];
  let selectIndex = 0;

  while (true) {
    const selectColumns = selectCandidates[selectIndex] ?? FINANCIAL_SELECT_WITHOUT_REFERENCIA_AND_RECEIPT_URLS;

    let query = supabase
      .from('financials')
      .select(selectColumns)
      .ilike('budget_version', 'realizado')
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + REALIZADO_RECEIPT_BATCH_PAGE_SIZE - 1);

    if (dateRange?.minIso && dateRange?.maxIso) {
      query = query.gte('transaction_date', dateRange.minIso).lte('transaction_date', dateRange.maxIso);
    }

    const { data, error } = await query;

    if (error) {
      const message = error.message ?? '';

      if (
        from === 0 &&
        selectIndex < selectCandidates.length - 1 &&
        (isMissingReceiptUrlsColumn(message) || isMissingReferenciaColumn(message))
      ) {
        selectIndex += 1;
        continue;
      }

      throw error;
    }

    if (!data?.length) {
      break;
    }

    rows.push(
      ...data
        .map((row) => normalizeFinancialEntryRow(row as Record<string, unknown>))
        .filter((row): row is FinancialEntry => row !== null)
    );

    if (data.length < REALIZADO_RECEIPT_BATCH_PAGE_SIZE) {
      break;
    }

    from += REALIZADO_RECEIPT_BATCH_PAGE_SIZE;
  }

  return rows;
}

export type MaintenanceFinancialDraft = {
  transactionDateIso: string;
  account: string;
  amount: number;
  ministry: string;
  transactionKind: string;
  movement: string;
  budgetVersion: string;
};

export const parseMaintenanceFinancialAmount = (value: string) => parseFinancialBulkAmount(value);

export type MaintenanceFinancialEntryUpdate = MaintenanceFinancialDraft;

export async function updateMaintenanceFinancialEntry(
  id: string,
  draft: MaintenanceFinancialEntryUpdate
) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  const { data, error } = await supabase.rpc('atualizar_lancamento_financeiro', {
    p_id: id,
    p_transaction_date: draft.transactionDateIso,
    p_account: draft.account.trim(),
    p_amount: draft.amount,
    p_ministry: draft.ministry.trim(),
    p_transaction_kind: draft.transactionKind.trim(),
    p_movement: draft.movement.trim(),
    p_budget_version: draft.budgetVersion.trim(),
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'atualizar_lancamento_financeiro')) {
      const { error: directError } = await supabase
        .from('financials')
        .update({
          transaction_date: draft.transactionDateIso,
          account: draft.account.trim(),
          amount: draft.amount,
          ministry: draft.ministry.trim(),
          transaction_kind: draft.transactionKind.trim(),
          movement: draft.movement.trim(),
          budget_version: draft.budgetVersion.trim(),
        })
        .eq('id', id);

      if (directError) {
        throw directError;
      }

      return {
        success: true,
        message: 'Lançamento atualizado.',
      };
    }

    handleRpcError(error, 'atualizar_lancamento_financeiro');
  }

  return parseRegisterScaleRpc(data);
}

export async function createMaintenanceFinancialEntry(draft: MaintenanceFinancialDraft) {
  const { data, error } = await supabase.rpc('cadastrar_lancamento_financeiro', {
    p_transaction_date: draft.transactionDateIso,
    p_account: draft.account.trim(),
    p_amount: draft.amount,
    p_ministry: draft.ministry.trim(),
    p_transaction_kind: draft.transactionKind.trim(),
    p_movement: draft.movement.trim(),
    p_budget_version: draft.budgetVersion.trim(),
  });

  if (error) {
    handleRpcError(error, 'cadastrar_lancamento_financeiro');
  }

  return parseRegisterScaleRpc(data);
}

export async function deleteMaintenanceFinancialEntry(id: string) {
  const { data, error } = await supabase.rpc('excluir_lancamento_financeiro', {
    p_id: id,
  });

  if (error) {
    handleRpcError(error, 'excluir_lancamento_financeiro');
  }

  return parseRegisterScaleRpc(data);
}

export async function updateMaintenanceFinancialEntryComment(id: string, comments: string | null) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  const normalizedComments = comments?.trim() || null;

  const { data, error } = await supabase.rpc('atualizar_comentario_lancamento_financeiro', {
    p_id: id,
    p_comments: normalizedComments,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'atualizar_comentario_lancamento_financeiro')) {
      const { error: directError } = await supabase
        .from('financials')
        .update({ comments: normalizedComments })
        .eq('id', id);

      if (directError) {
        throw directError;
      }

      return {
        success: true,
        message: normalizedComments ? 'Comentário salvo.' : 'Comentário removido.',
      };
    }

    handleRpcError(error, 'atualizar_comentario_lancamento_financeiro');
  }

  return parseRegisterScaleRpc(data);
}

export async function updateMaintenanceFinancialEntryReceipts(
  id: string,
  receiptUrls: string[]
) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  const normalizedReceiptUrls = normalizeFinancialReceiptUrls(receiptUrls);

  if (normalizedReceiptUrls.length > FINANCIAL_MAX_RECEIPTS_PER_ENTRY) {
    return {
      success: false as const,
      message: `Cada lançamento aceita no máximo ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
    };
  }

  const { data, error } = await supabase.rpc('atualizar_comprovante_lancamento_financeiro', {
    p_id: id,
    p_receipt_urls: normalizedReceiptUrls,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'atualizar_comprovante_lancamento_financeiro')) {
      const { error: directError } = await supabase
        .from('financials')
        .update({
          receipt_urls: normalizedReceiptUrls,
          receipt_url: normalizedReceiptUrls[0] ?? null,
        })
        .eq('id', id);

      if (directError && isMissingReceiptUrlsColumn(directError.message ?? '')) {
        const { error: legacyError } = await supabase
          .from('financials')
          .update({
            receipt_url: normalizedReceiptUrls[0] ?? null,
          })
          .eq('id', id);

        if (legacyError) {
          throw legacyError;
        }

        return {
          success: true,
          message:
            normalizedReceiptUrls.length > 1
              ? 'Execute scripts/financials-receipt-urls.sql no Supabase para suportar múltiplos comprovantes. Apenas o primeiro foi salvo.'
              : normalizedReceiptUrls.length
                ? 'Comprovante anexado.'
                : 'Comprovante removido.',
          receipt_urls: normalizedReceiptUrls.slice(0, 1),
          receipt_url: normalizedReceiptUrls[0] ?? null,
        };
      }

      if (directError) {
        throw directError;
      }

      return {
        success: true,
        message: normalizedReceiptUrls.length ? 'Comprovantes atualizados.' : 'Comprovante removido.',
        receipt_urls: normalizedReceiptUrls,
        receipt_url: normalizedReceiptUrls[0] ?? null,
      };
    }

    handleRpcError(error, 'atualizar_comprovante_lancamento_financeiro');
  }

  const parsed = parseRegisterScaleRpc(data);
  const parsedRecord = (data ?? {}) as Record<string, unknown>;
  const nextReceiptUrls = normalizeFinancialReceiptUrls(parsedRecord.receipt_urls);

  return {
    ...parsed,
    receipt_urls: nextReceiptUrls,
    receipt_url: nextReceiptUrls[0] ?? null,
  };
}

export async function updateMaintenanceFinancialEntryReceipt(id: string, receiptUrl: string | null) {
  return updateMaintenanceFinancialEntryReceipts(
    id,
    receiptUrl?.trim() ? [receiptUrl.trim()] : []
  );
}

export async function attachMaintenanceFinancialReceipt(
  entryId: string,
  imageInput: string,
  existingReceiptUrls: string[] = [],
  position?: number,
  force = false
) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  const currentUrls = normalizeFinancialReceiptUrls(existingReceiptUrls);
  const targetPosition = position ?? currentUrls.length + 1;

  if (targetPosition > FINANCIAL_MAX_RECEIPTS_PER_ENTRY) {
    return {
      success: false as const,
      message: `Cada lançamento aceita no máximo ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
    };
  }

  if (!position && !force && currentUrls.length >= FINANCIAL_MAX_RECEIPTS_PER_ENTRY) {
    return {
      success: false as const,
      message: `Cada lançamento aceita no máximo ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
    };
  }

  let uploadedPath: string | null = null;

  try {
    uploadedPath = await uploadFinancialReceiptImage(entryId, imageInput);

    const { data, error } = await supabase.rpc('anexar_comprovante_lancamento_financeiro', {
      p_id: entryId,
      p_receipt_path: uploadedPath,
      p_position: position ?? null,
      p_force: force,
    });

    if (!error && data && typeof data === 'object') {
      const parsed = data as Record<string, unknown>;
      const rpcSuccess = parsed.success === true;

      if (rpcSuccess) {
        const nextReceiptUrls = normalizeFinancialReceiptUrls(parsed.receipt_urls);
        const replacedUrl =
          typeof parsed.replaced_url === 'string' ? parsed.replaced_url.trim() : '';

        if (replacedUrl && replacedUrl !== uploadedPath) {
          await deleteFinancialReceiptFile(replacedUrl).catch(() => undefined);
        }

        return {
          success: true as const,
          message:
            typeof parsed.message === 'string' ? parsed.message : 'Comprovante anexado.',
          receipt_urls: nextReceiptUrls,
          receipt_url: nextReceiptUrls[0] ?? null,
        };
      }

      if (uploadedPath) {
        await deleteFinancialReceiptFile(uploadedPath).catch(() => undefined);
      }

      return {
        success: false as const,
        message:
          typeof parsed.message === 'string'
            ? parsed.message
            : 'Não foi possível vincular o comprovante ao lançamento.',
      };
    }

    const rpcMessage = (error?.message ?? '').toLowerCase();

    if (!isSupabaseRpcMissing(rpcMessage, 'anexar_comprovante_lancamento_financeiro')) {
      if (uploadedPath) {
        await deleteFinancialReceiptFile(uploadedPath).catch(() => undefined);
      }

      if (error) {
        throw error;
      }
    }

    const placed = placeFinancialReceiptAtPosition(currentUrls, targetPosition, uploadedPath);

    if (placed.error) {
      await deleteFinancialReceiptFile(uploadedPath).catch(() => undefined);

      return {
        success: false as const,
        message: placed.error,
      };
    }

    const nextUrls = placed.urls;
    const result = await updateMaintenanceFinancialEntryReceipts(entryId, nextUrls);

    if (!result.success) {
      await deleteFinancialReceiptFile(uploadedPath).catch(() => undefined);

      return {
        success: false as const,
        message: result.message ?? 'Não foi possível vincular o comprovante ao lançamento.',
      };
    }

    if (placed.replacedUrl && placed.replacedUrl !== uploadedPath) {
      await deleteFinancialReceiptFile(placed.replacedUrl).catch(() => undefined);
    }

    return {
      success: true as const,
      message: result.message ?? 'Comprovante anexado.',
      receipt_urls: nextUrls,
      receipt_url: nextUrls[0] ?? null,
    };
  } catch (err) {
    if (uploadedPath) {
      await deleteFinancialReceiptFile(uploadedPath).catch(() => undefined);
    }

    throw err;
  }
}

export async function removeMaintenanceFinancialReceipt(
  entryId: string,
  receiptUrl: string | null | undefined,
  existingReceiptUrls: string[] = []
) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  const currentUrls = normalizeFinancialReceiptUrls(existingReceiptUrls);
  const targetUrl = receiptUrl?.trim() || null;
  const nextUrls = targetUrl ? currentUrls.filter((url) => url !== targetUrl) : [];

  const result = await updateMaintenanceFinancialEntryReceipts(entryId, nextUrls);

  if (!result.success) {
    return {
      success: false as const,
      message: result.message ?? 'Não foi possível remover o comprovante.',
    };
  }

  if (targetUrl) {
    await deleteFinancialReceiptFile(targetUrl);
  }

  return {
    success: true as const,
    message: result.message ?? 'Comprovante removido.',
    receipt_urls: nextUrls,
    receipt_url: nextUrls[0] ?? null,
  };
}

export async function deleteMaintenanceFinancialEntriesForPeriod(
  periodMode: MaintenanceFinancialPeriodMode,
  referenceIsoDate: string,
  budgetVersion: string
) {
  const { data, error } = await supabase.rpc('excluir_lancamentos_financeiros_periodo', {
    p_periodo: periodMode === 'day' ? 'dia' : 'mes',
    p_referencia: referenceIsoDate,
    p_budget_version: budgetVersion.trim(),
  });

  if (error) {
    handleRpcError(error, 'excluir_lancamentos_financeiros_periodo');
  }

  return parseRegisterScaleRpc(data);
}

const BULK_IMPORT_CHUNK_SIZE = 250;

export type MaintenanceFinancialBulkImportResult = {
  success: boolean;
  message?: string;
  insertedCount: number;
  deletedCount: number;
};

export const parseMaintenanceFinancialBulkRpc = (data: unknown): MaintenanceFinancialBulkImportResult => {
  const base = parseRegisterScaleRpc(data);

  if (!data || typeof data !== 'object') {
    return { ...base, insertedCount: 0, deletedCount: 0 };
  }

  const row = data as Record<string, unknown>;

  return {
    success: base.success,
    message: base.message,
    insertedCount: Number(row.inserted_count) || 0,
    deletedCount: Number(row.deleted_count) || 0,
  };
};

export async function importMaintenanceFinancialBulk(
  periodMode: MaintenanceFinancialPeriodMode,
  referenceIsoDate: string,
  rows: FinancialBulkRow[],
  replacePeriod: boolean,
  budgetVersion: string
): Promise<MaintenanceFinancialBulkImportResult> {
  if (!rows.length) {
    return {
      success: false,
      message: 'Nenhum lançamento válido para importar.',
      insertedCount: 0,
      deletedCount: 0,
    };
  }

  const chunks: FinancialBulkRow[][] = [];

  for (let offset = 0; offset < rows.length; offset += BULK_IMPORT_CHUNK_SIZE) {
    chunks.push(rows.slice(offset, offset + BULK_IMPORT_CHUNK_SIZE));
  }

  let insertedCount = 0;
  let deletedCount = 0;
  let lastMessage: string | undefined;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const shouldReplacePeriod = replacePeriod && chunkIndex === 0;
    const { data, error } = await supabase.rpc('carga_lote_lancamentos_financeiros', {
      p_periodo: periodMode === 'day' ? 'dia' : 'mes',
      p_referencia: referenceIsoDate,
      p_rows: financialBulkRowsToRpcPayload(chunks[chunkIndex]),
      p_substituir: shouldReplacePeriod,
      p_budget_version: budgetVersion.trim(),
    });

    if (error) {
      handleRpcError(error, 'carga_lote_lancamentos_financeiros');
    }

    const parsed = parseMaintenanceFinancialBulkRpc(data);

    if (!parsed.success) {
      return {
        success: false,
        message: parsed.message ?? 'Não foi possível importar a carga em lote.',
        insertedCount,
        deletedCount,
      };
    }

    insertedCount += parsed.insertedCount;
    deletedCount += parsed.deletedCount;
    lastMessage = parsed.message;
  }

  if (chunks.length > 1) {
    return {
      success: true,
      message: `${insertedCount} lançamento(s) importado(s) em ${chunks.length} lote(s).`,
      insertedCount,
      deletedCount,
    };
  }

  return {
    success: true,
    message: lastMessage ?? `${insertedCount} lançamento(s) importado(s).`,
    insertedCount,
    deletedCount,
  };
}
