import { createUuid } from '@/lib/createUuid';
import { getAppParameterValue } from '@/lib/appParameters';
import { loadSessionProfile } from '@/lib/loadSessionProfile';
import {
  deleteFinancialReceiptFile,
  uploadExpenseReportReceiptImage,
} from '@/lib/financialReceipt';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import { getStoredUserPhone } from '@/lib/userSession';
import { buildWaMeUrl } from '@/lib/whatsapp';

export const EXPENSE_REPORT_SQL_HINT =
  'Execute no Supabase: scripts/expense-reports-schema.sql e scripts/expense-reports-rpc.sql.';

export const EXPENSE_REPORT_RPC_MISSING = 'EXPENSE_REPORT_RPC_MISSING';

export type ExpenseReportStatus = 'pending' | 'reconciled';

export type ExpenseReportItem = {
  id: string;
  date: string;
  description: string;
  amount: number;
  receipt_url?: string | null;
};

export type ExpenseReportSummary = {
  id: string;
  report_number: string;
  created_at: string;
  total_amount: number;
  pix_key: string;
  status: ExpenseReportStatus;
  financial_id?: string | null;
  item_descriptions: string;
};

export type ExpenseReportDetail = ExpenseReportSummary & {
  user_id: string;
  items: ExpenseReportItem[];
};

export type ExpenseReportDraftItem = {
  id: string;
  dateInput: string;
  description: string;
  amountInput: string;
  receiptImage: string | null;
  receiptUrl: string | null;
};

export type ExpenseReportPendingRow = {
  id: string;
  report_number: string;
  created_at: string;
  total_amount: number;
  pix_key: string;
  user_id: string;
  member_name: string;
  member_phone: string;
  items_count: number;
  item_descriptions: string;
};

export type ExpenseReportMaintenanceRow = ExpenseReportPendingRow & {
  status: ExpenseReportStatus;
  financial_id: string | null;
};

export type ExpenseReportHeader = {
  profileId: string;
  fullName: string;
  phone: string;
  pixKey: string;
};

const parseExpenseReportStatus = (value: unknown): ExpenseReportStatus =>
  value === 'reconciled' ? 'reconciled' : 'pending';

const parseExpenseReportSummary = (row: Record<string, unknown>): ExpenseReportSummary => ({
  id: String(row.id ?? ''),
  report_number: String(row.report_number ?? ''),
  created_at: String(row.created_at ?? ''),
  total_amount: Number(row.total_amount) || 0,
  pix_key: String(row.pix_key ?? ''),
  status: parseExpenseReportStatus(row.status),
  financial_id:
    typeof row.financial_id === 'string' && row.financial_id.trim() ? row.financial_id.trim() : null,
  item_descriptions: String(row.item_descriptions ?? '').trim(),
});

const parseExpenseReportItems = (items: unknown): ExpenseReportItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') {
        return null;
      }

      const row = raw as Record<string, unknown>;
      const id = String(row.id ?? '').trim();

      if (!id) {
        return null;
      }

      return {
        id,
        date: String(row.date ?? ''),
        description: String(row.description ?? ''),
        amount: Number(row.amount) || 0,
        receipt_url:
          typeof row.receipt_url === 'string' && row.receipt_url.trim()
            ? row.receipt_url.trim()
            : null,
      };
    })
    .filter((item): item is ExpenseReportItem => item !== null);
};

const handleRpcError = (error: { message?: string }, functionName: string) => {
  const message = (error.message ?? '').toLowerCase();

  if (isSupabaseRpcMissing(message, functionName)) {
    const schemaError = new Error(EXPENSE_REPORT_RPC_MISSING);
    schemaError.name = 'ExpenseReportRpcMissing';
    throw schemaError;
  }

  throw error;
};

export const formatExpenseReportAmount = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatExpenseReportDate = (isoDate: string) => {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return isoDate;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

export const formatExpenseReportDateTime = (isoDate: string) => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const parseExpenseReportDateInput = (value: string): string | null => {
  const trimmed = value.trim();

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);

  if (brMatch) {
    const [, day, month, yearRaw] = brMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return trimmed;
  }

  return null;
};

export const sanitizeExpenseAmountInput = (value: string) => value.replace(/[^\d.,]/g, '');

const normalizeBrazilianAmountString = (value: string): string | null => {
  const trimmed = sanitizeExpenseAmountInput(value.trim());

  if (!trimmed) {
    return null;
  }

  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      return trimmed.replace(/\./g, '').replace(',', '.');
    }

    return trimmed.replace(/,/g, '');
  }

  if (lastComma >= 0) {
    return trimmed.replace(/\./g, '').replace(',', '.');
  }

  if (lastDot >= 0) {
    const parts = trimmed.split('.');

    if (parts.length === 2 && (parts[1]?.length ?? 0) <= 2) {
      return trimmed;
    }

    return trimmed.replace(/\./g, '');
  }

  return trimmed;
};

export const parseExpenseReportAmountInput = (value: string): number | null => {
  const trimmed = sanitizeExpenseAmountInput(value.trim());

  if (!trimmed) {
    return null;
  }

  const withoutTrailingSeparator = trimmed.replace(/[.,]$/, '');

  if (!withoutTrailingSeparator) {
    return null;
  }

  const normalized = normalizeBrazilianAmountString(withoutTrailingSeparator);

  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

/** Soma parcial enquanto o usuário digita (ex.: "12," ou "12,5"). */
export const parseExpenseReportAmountInputLenient = (value: string): number => {
  const parsed = parseExpenseReportAmountInput(value);

  if (parsed !== null) {
    return parsed;
  }

  const trimmed = sanitizeExpenseAmountInput(value.trim()).replace(/[.,]$/, '');

  if (!trimmed) {
    return 0;
  }

  return parseExpenseReportAmountInput(trimmed) ?? 0;
};

/** Data local de hoje no formato usado no formulário do RD (DD/MM/AAAA). */
export const getExpenseReportTodayDateInput = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());

  return `${day}/${month}/${year}`;
};

export const sanitizeExpenseReportDateInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const createEmptyExpenseReportDraftItem = (): ExpenseReportDraftItem => ({
  id: createUuid(),
  dateInput: getExpenseReportTodayDateInput(),
  description: '',
  amountInput: '',
  receiptImage: null,
  receiptUrl: null,
});

export async function loadExpenseReportHeader(): Promise<ExpenseReportHeader | null> {
  const phone = (await getStoredUserPhone())?.trim();

  if (!phone) {
    return null;
  }

  const profile = await loadSessionProfile(phone);

  if (!profile?.id) {
    return null;
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('pix_key')
    .eq('id', profile.id)
    .maybeSingle();

  return {
    profileId: profile.id,
    fullName: profile.full_name?.trim() || '—',
    phone: profile.phone?.trim() || phone,
    pixKey:
      (typeof profileRow?.pix_key === 'string' ? profileRow.pix_key.trim() : '') ||
      '',
  };
}

export const validateExpenseReportDraft = (input: {
  pixKey: string;
  items: ExpenseReportDraftItem[];
}): string | null => {
  if (!input.pixKey.trim()) {
    return 'Informe a chave PIX para reembolso.';
  }

  if (!input.items.length) {
    return 'Adicione ao menos uma linha de despesa.';
  }

  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    const line = index + 1;

    if (!parseExpenseReportDateInput(item.dateInput)) {
      return `Linha ${line}: informe uma data válida (DD/MM/AAAA).`;
    }

    if (!item.description.trim()) {
      return `Linha ${line}: informe a descrição.`;
    }

    if (parseExpenseReportAmountInput(item.amountInput) === null) {
      return `Linha ${line}: informe um valor maior que zero.`;
    }
  }

  return null;
};

export const buildExpenseReportWhatsappMessage = (input: {
  reportNumber: string;
  memberName: string;
  memberPhone: string;
  pixKey: string;
  totalAmount: number;
  items: ExpenseReportItem[];
}) => {
  const lines = [
    `*Relatório de Despesas ${input.reportNumber}*`,
    `Solicitante: ${input.memberName}`,
    `Telefone: ${input.memberPhone}`,
    `PIX: ${input.pixKey}`,
    `Total: ${formatExpenseReportAmount(input.totalAmount)}`,
    '',
    '*Itens:*',
    ...input.items.map(
      (item) =>
        `${formatExpenseReportDate(item.date)} — ${item.description} — ${formatExpenseReportAmount(item.amount)}`
    ),
  ];

  return lines.join('\n');
};

export async function submitExpenseReport(input: {
  pixKey: string;
  items: ExpenseReportDraftItem[];
}): Promise<{ success: true; report: ExpenseReportDetail } | { success: false; message: string }> {
  const validationError = validateExpenseReportDraft(input);

  if (validationError) {
    return { success: false, message: validationError };
  }

  const reportId = createUuid();
  const preparedItems: ExpenseReportItem[] = [];

  try {
    for (const draft of input.items) {
      const amount = parseExpenseReportAmountInput(draft.amountInput);

      if (amount === null) {
        return { success: false, message: 'Há valores inválidos no relatório.' };
      }

      const dateIso = parseExpenseReportDateInput(draft.dateInput);

      if (!dateIso) {
        return { success: false, message: 'Há datas inválidas no relatório.' };
      }

      let receiptUrl: string | null = null;

      if (draft.receiptImage) {
        receiptUrl = await uploadExpenseReportReceiptImage(reportId, draft.id, draft.receiptImage);
      }

      preparedItems.push({
        id: draft.id,
        date: dateIso,
        description: draft.description.trim(),
        amount,
        receipt_url: receiptUrl,
      });
    }

    const { data, error } = await supabase.rpc('criar_relatorio_despesas', {
      p_pix_key: input.pixKey.trim(),
      p_report_id: reportId,
      p_items: preparedItems.map((item) => ({
        id: item.id,
        date: item.date,
        description: item.description,
        amount: item.amount,
        receipt_url: item.receipt_url,
      })),
    });

    if (error) {
      handleRpcError(error, 'criar_relatorio_despesas');
    }

    const parsed = (data ?? {}) as Record<string, unknown>;

    if (!parsed.success) {
      return {
        success: false,
        message: String(parsed.message ?? 'Não foi possível finalizar o relatório.'),
      };
    }

    const createdId = String(parsed.id ?? reportId);
    const detail = await fetchExpenseReportDetail(createdId);

    if (!detail) {
      return { success: false, message: 'Relatório criado, mas não foi possível carregá-lo.' };
    }

    return { success: true, report: detail };
  } catch (err) {
    if (err instanceof Error && err.message === EXPENSE_REPORT_RPC_MISSING) {
      return { success: false, message: EXPENSE_REPORT_SQL_HINT };
    }

    console.error('Erro ao finalizar RD:', err);

    return {
      success: false,
      message: err instanceof Error ? err.message : 'Não foi possível finalizar o relatório.',
    };
  }
}

export const splitExpenseReportDescriptions = (value: string) =>
  value
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean);

export async function deleteExpenseReport(
  reportId: string
): Promise<{ success: boolean; message: string }> {
  const detail = await fetchExpenseReportDetail(reportId);

  if (!detail) {
    return { success: false, message: 'Relatório não encontrado.' };
  }

  if (detail.status !== 'pending') {
    return { success: false, message: 'Somente relatórios pendentes podem ser excluídos.' };
  }

  const { data, error } = await supabase.rpc('excluir_relatorio_despesas', {
    p_report_id: reportId,
  });

  if (error) {
    handleRpcError(error, 'excluir_relatorio_despesas');
  }

  const parsed = (data ?? {}) as Record<string, unknown>;

  if (!parsed.success) {
    return {
      success: false,
      message: String(parsed.message ?? 'Não foi possível excluir o relatório.'),
    };
  }

  await Promise.all(
    detail.items.map(async (item) => {
      if (!item.receipt_url) {
        return;
      }

      try {
        await deleteFinancialReceiptFile(item.receipt_url);
      } catch (receiptError) {
        console.warn('Não foi possível remover comprovante do RD:', receiptError);
      }
    })
  );

  return {
    success: true,
    message: String(parsed.message ?? 'Relatório de despesas excluído.'),
  };
}

export async function fetchMyExpenseReports(): Promise<ExpenseReportSummary[]> {
  const { data, error } = await supabase.rpc('listar_meus_relatorios_despesas');

  if (error) {
    handleRpcError(error, 'listar_meus_relatorios_despesas');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => parseExpenseReportSummary(row as Record<string, unknown>));
}

export async function fetchExpenseReportDetail(
  reportId: string
): Promise<ExpenseReportDetail | null> {
  const { data, error } = await supabase.rpc('obter_relatorio_despesas', {
    p_id: reportId,
  });

  if (error) {
    handleRpcError(error, 'obter_relatorio_despesas');
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as Record<string, unknown>;

  if (!payload.success || !payload.report || typeof payload.report !== 'object') {
    return null;
  }

  const report = payload.report as Record<string, unknown>;
  const items = parseExpenseReportItems(payload.items);

  return {
    ...parseExpenseReportSummary(report),
    item_descriptions: items.map((item) => item.description).join(' · '),
    user_id: String(report.user_id ?? ''),
    items,
  };
}

export async function fetchPendingExpenseReports(): Promise<ExpenseReportPendingRow[]> {
  const { data, error } = await supabase.rpc('listar_relatorios_despesas_pendentes');

  if (error) {
    handleRpcError(error, 'listar_relatorios_despesas_pendentes');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const record = row as Record<string, unknown>;

    return {
      id: String(record.id ?? ''),
      report_number: String(record.report_number ?? ''),
      created_at: String(record.created_at ?? ''),
      total_amount: Number(record.total_amount) || 0,
      pix_key: String(record.pix_key ?? ''),
      user_id: String(record.user_id ?? ''),
      member_name: String(record.member_name ?? '—'),
      member_phone: String(record.member_phone ?? '—'),
      items_count: Number(record.items_count) || 0,
      item_descriptions: String(record.item_descriptions ?? '').trim(),
    };
  });
}

export async function fetchExpenseReportsForMaintenanceMonth(
  referenceIsoDate: string
): Promise<ExpenseReportMaintenanceRow[]> {
  const { data, error } = await supabase.rpc('listar_relatorios_despesas_periodo', {
    p_referencia: referenceIsoDate,
  });

  if (error) {
    handleRpcError(error, 'listar_relatorios_despesas_periodo');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const record = row as Record<string, unknown>;

    return {
      id: String(record.id ?? ''),
      report_number: String(record.report_number ?? ''),
      created_at: String(record.created_at ?? ''),
      total_amount: Number(record.total_amount) || 0,
      pix_key: String(record.pix_key ?? ''),
      user_id: String(record.user_id ?? ''),
      member_name: String(record.member_name ?? '—'),
      member_phone: String(record.member_phone ?? '—'),
      items_count: Number(record.items_count) || 0,
      item_descriptions: String(record.item_descriptions ?? '').trim(),
      status: parseExpenseReportStatus(record.status),
      financial_id:
        typeof record.financial_id === 'string' && record.financial_id.trim()
          ? record.financial_id.trim()
          : null,
    };
  });
}

export async function unreconcileExpenseReport(
  reportId: string
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('desconciliar_relatorio_despesas', {
    p_report_id: reportId,
  });

  if (error) {
    handleRpcError(error, 'desconciliar_relatorio_despesas');
  }

  const parsed = (data ?? {}) as Record<string, unknown>;

  return {
    success: Boolean(parsed.success),
    message: String(parsed.message ?? 'Não foi possível remover a conciliação.'),
  };
}

export async function reconcileExpenseReport(
  reportId: string,
  financialId: string
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('conciliar_relatorio_despesas', {
    p_report_id: reportId,
    p_financial_id: financialId,
  });

  if (error) {
    handleRpcError(error, 'conciliar_relatorio_despesas');
  }

  const parsed = (data ?? {}) as Record<string, unknown>;

  return {
    success: Boolean(parsed.success),
    message: String(parsed.message ?? 'Não foi possível vincular o relatório.'),
  };
}

export async function resolveTreasurerWhatsappUrl(message: string) {
  const treasurerPhone = await getAppParameterValue('Tesoureiro_contato');
  return buildWaMeUrl(treasurerPhone, message);
}
