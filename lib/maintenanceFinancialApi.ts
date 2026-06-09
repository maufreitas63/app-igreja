import {
  financialBulkRowsToRpcPayload,
  parseFinancialBulkAmount,
  type FinancialBulkRow,
} from '@/lib/maintenanceFinancialBulk';
import { parseMaintenanceEventDateTimeToIso } from '@/lib/maintenanceEventForm';
import { parseRegisterScaleRpc } from '@/lib/maintenanceScales';
import { sessionHasAccess } from '@/lib/accessControl';
import {
  deleteFinancialReceiptFile,
  uploadFinancialReceiptImage,
} from '@/lib/financialReceipt';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import { normalizeFinancialEntryRow, type FinancialEntry } from '@/lib/financialEntry';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { getFinancialMonthDateRange } from '@/lib/financialMonth';

export const MAINTENANCE_FINANCIALS_SQL_HINT =
  'Execute no Supabase: scripts/financials-schema.sql e scripts/financials-maintenance-rpc.sql (carga em lote, comentários e comprovantes).';

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
  'id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, receipt_url';

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

  return data
    .map((row) => normalizeFinancialEntryRow(row as Record<string, unknown>))
    .filter((row): row is FinancialEntry => row !== null);
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

  let query = supabase
    .from('financials')
    .select(FINANCIAL_SELECT)
    .gte('transaction_date', bounds.startDate)
    .order('transaction_date', { ascending: false })
    .order('account', { ascending: true });

  if (periodMode === 'day') {
    query = query.eq('transaction_date', bounds.startDate);
  } else {
    query = query.lte('transaction_date', bounds.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return parseFinancialRows(data);
}

export async function fetchMaintenanceFinancialEntries(
  periodMode: MaintenanceFinancialPeriodMode,
  referenceIsoDate: string
) {
  try {
    return await listMaintenanceFinancialEntries(periodMode, referenceIsoDate);
  } catch (err) {
    if (err instanceof Error && err.message === MAINTENANCE_FINANCIALS_RPC_MISSING) {
      return listMaintenanceFinancialEntriesDirect(periodMode, referenceIsoDate);
    }

    throw err;
  }
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

export async function updateMaintenanceFinancialEntryReceipt(id: string, receiptUrl: string | null) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  const normalizedReceiptUrl = receiptUrl?.trim() || null;

  const { data, error } = await supabase.rpc('atualizar_comprovante_lancamento_financeiro', {
    p_id: id,
    p_receipt_url: normalizedReceiptUrl,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'atualizar_comprovante_lancamento_financeiro')) {
      const { error: directError } = await supabase
        .from('financials')
        .update({ receipt_url: normalizedReceiptUrl })
        .eq('id', id);

      if (directError) {
        throw directError;
      }

      return {
        success: true,
        message: normalizedReceiptUrl ? 'Comprovante anexado.' : 'Comprovante removido.',
        receipt_url: normalizedReceiptUrl,
      };
    }

    handleRpcError(error, 'atualizar_comprovante_lancamento_financeiro');
  }

  const parsed = parseRegisterScaleRpc(data);

  return {
    ...parsed,
    receipt_url: normalizedReceiptUrl,
  };
}

export async function attachMaintenanceFinancialReceipt(
  entryId: string,
  imageInput: string,
  previousReceiptUrl?: string | null
) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  let uploadedPath: string | null = null;

  try {
    uploadedPath = await uploadFinancialReceiptImage(entryId, imageInput);

    const result = await updateMaintenanceFinancialEntryReceipt(entryId, uploadedPath);

    if (!result.success) {
      if (uploadedPath) {
        await deleteFinancialReceiptFile(uploadedPath).catch(() => undefined);
      }

      return {
        success: false as const,
        message: result.message ?? 'Não foi possível vincular o comprovante ao lançamento.',
      };
    }

    if (previousReceiptUrl?.trim()) {
      await deleteFinancialReceiptFile(previousReceiptUrl).catch(() => undefined);
    }

    return {
      success: true as const,
      message: result.message ?? 'Comprovante anexado.',
      receipt_url: uploadedPath,
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
  receiptUrl: string | null | undefined
) {
  const access = await assertMaintenanceFinancialUpdateAccess();

  if (!access.success) {
    return access;
  }

  const result = await updateMaintenanceFinancialEntryReceipt(entryId, null);

  if (!result.success) {
    return {
      success: false as const,
      message: result.message ?? 'Não foi possível remover o comprovante.',
    };
  }

  if (receiptUrl?.trim()) {
    await deleteFinancialReceiptFile(receiptUrl);
  }

  return {
    success: true as const,
    message: result.message ?? 'Comprovante removido.',
    receipt_url: null,
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
