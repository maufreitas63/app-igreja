/**
 * Contas bancárias/Pix da instância (public.bank_accounts).
 * SQL: scripts/bank-accounts-schema.sql
 */

import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PIX_ACCOUNTS_SQL_HINT = 'Execute no Supabase: scripts/bank-accounts-schema.sql';

export type PixAccountSlot = string;

export const BANK_ACCOUNT_TYPES = ['corrente', 'poupanca', 'pagamento', 'salario', 'outro'] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

export type PixAccount = {
  id: string;
  slot: PixAccountSlot;
  label: string;
  pixKey: string | null;
  institution: string | null;
  holderName: string | null;
  document: string | null;
  agency: string | null;
  accountNumber: string | null;
  accountType: BankAccountType | null;
  isActive: boolean;
  isDefaultOfferings: boolean;
  sortOrder: number;
};

export type PixAccountsBundle = {
  defaultId: string | null;
  defaultSlot: PixAccountSlot;
  accounts: PixAccount[];
  canManage: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

function textOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function parseAccountType(value: unknown): BankAccountType | null {
  const raw = textOrNull(value);
  if (raw && (BANK_ACCOUNT_TYPES as readonly string[]).includes(raw)) {
    return raw as BankAccountType;
  }
  return null;
}

function coerceJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function parseAccount(value: unknown): PixAccount | null {
  const row = asRecord(coerceJson(value));
  const id = textOrNull(row.id);
  if (!id) {
    return null;
  }

  const label = textOrNull(row.label) || 'Conta Pix';

  return {
    id,
    slot: id,
    label,
    pixKey: textOrNull(row.pix_key),
    institution: textOrNull(row.institution) || label,
    holderName: textOrNull(row.holder_name),
    document: textOrNull(row.document),
    agency: textOrNull(row.agency),
    accountNumber: textOrNull(row.account_number),
    accountType: parseAccountType(row.account_type),
    isActive: row.is_active !== false,
    isDefaultOfferings: row.is_default_offerings === true,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function emptyBundle(): PixAccountsBundle {
  return {
    defaultId: null,
    defaultSlot: '',
    canManage: false,
    accounts: [],
  };
}

function parseBundle(payload: Record<string, unknown>): PixAccountsBundle {
  const accountsRaw = coerceJson(payload.accounts ?? payload.pix_accounts);
  const accounts = Array.isArray(accountsRaw)
    ? accountsRaw.map(parseAccount).filter((row): row is PixAccount => row !== null)
    : [];
  const defaultId =
    textOrNull(payload.default_id) ||
    textOrNull(payload.default_slot) ||
    accounts.find((item) => item.isDefaultOfferings)?.id ||
    accounts[0]?.id ||
    null;

  return {
    defaultId,
    defaultSlot: defaultId ?? '',
    canManage: payload.can_manage === true || payload.can_manage === 'true',
    accounts,
  };
}

export function normalizePixAccountSlot(value: unknown): PixAccountSlot {
  return textOrNull(value) || '';
}

export function pixAccountBySlot(
  bundle: PixAccountsBundle | null | undefined,
  slot: unknown
): PixAccount | null {
  if (!bundle) {
    return null;
  }

  const id = textOrNull(slot);
  if (!id) {
    return bundle.accounts.find((item) => item.id === bundle.defaultId) ?? bundle.accounts[0] ?? null;
  }

  return bundle.accounts.find((account) => account.id === id) ?? null;
}

export function pixAccountById(
  bundle: PixAccountsBundle | null | undefined,
  id: unknown
): PixAccount | null {
  return pixAccountBySlot(bundle, id);
}

export function resolvePixKeyForSlot(
  bundle: PixAccountsBundle | null | undefined,
  slot: unknown,
  fallback?: string | null
): string | null {
  const selected = pixAccountBySlot(bundle, slot)?.pixKey ?? null;
  if (selected) {
    return selected;
  }

  const def = pixAccountBySlot(bundle, bundle?.defaultId)?.pixKey;
  return def ?? textOrNull(fallback);
}

export function resolvePixInstitutionForSlot(
  bundle: PixAccountsBundle | null | undefined,
  slot: unknown,
  fallback?: string | null
): string | null {
  const selected = pixAccountBySlot(bundle, slot);
  return (
    textOrNull(selected?.institution) ||
    textOrNull(selected?.label) ||
    textOrNull(fallback)
  );
}

export function pixAccountDropdownOptions(bundle: PixAccountsBundle | null | undefined) {
  return (bundle?.accounts ?? []).map((account) => ({
    value: account.id,
    label: account.pixKey ? account.label : `${account.label} (sem chave)`,
  }));
}

export async function fetchSessionPixAccounts(): Promise<PixAccountsBundle> {
  const { data, error } = await supabase.rpc('get_session_pix_accounts');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_session_pix_accounts')) {
      throw new Error(PIX_ACCOUNTS_SQL_HINT);
    }

    throw new Error(error.message || 'Falha ao carregar contas bancárias.');
  }

  const payload = asRecord(coerceJson(data));

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Sem permissão para contas bancárias.'));
  }

  return parseBundle(payload);
}

export async function upsertBankAccountAdmin(input: {
  id?: string | null;
  label: string;
  institution?: string | null;
  holderName?: string | null;
  document?: string | null;
  agency?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
  pixKey?: string | null;
  isDefaultOfferings?: boolean;
  isActive?: boolean;
}): Promise<PixAccountsBundle> {
  const { data, error } = await supabase.rpc('upsert_bank_account_admin', {
    p_id: input.id?.trim() || null,
    p_label: input.label,
    p_institution: input.institution ?? input.label,
    p_holder_name: input.holderName ?? null,
    p_document: input.document ?? null,
    p_agency: input.agency ?? null,
    p_account_number: input.accountNumber ?? null,
    p_account_type: input.accountType ?? null,
    p_pix_key: input.pixKey ?? null,
    p_is_default_offerings: input.isDefaultOfferings ?? false,
    p_is_active: input.isActive ?? true,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'upsert_bank_account_admin')) {
      throw new Error(PIX_ACCOUNTS_SQL_HINT);
    }

    throw new Error(error.message || 'Falha ao salvar a conta bancária.');
  }

  const payload = asRecord(coerceJson(data));

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Não foi possível salvar a conta bancária.'));
  }

  return parseBundle(payload);
}

export async function deleteBankAccountAdmin(id: string): Promise<PixAccountsBundle> {
  const { data, error } = await supabase.rpc('delete_bank_account_admin', { p_id: id });

  if (error) {
    throw new Error(error.message || 'Falha ao excluir a conta bancária.');
  }

  const payload = asRecord(coerceJson(data));

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Não foi possível excluir a conta.'));
  }

  return parseBundle(payload);
}

export async function savePixAccountsAdmin(input: {
  nomeConta1: string;
  chavePix1: string;
  nomeConta2: string;
  chavePix2: string;
  padraoOfertas: PixAccountSlot;
}): Promise<PixAccountsBundle> {
  const first = await upsertBankAccountAdmin({
    label: input.nomeConta1 || 'Conta 1',
    institution: input.nomeConta1,
    pixKey: input.chavePix1,
    isDefaultOfferings: true,
  });

  if (input.chavePix2.trim() || input.nomeConta2.trim()) {
    return upsertBankAccountAdmin({
      id: first.accounts.find((item) => item.id !== first.accounts[0]?.id)?.id,
      label: input.nomeConta2 || 'Conta 2',
      institution: input.nomeConta2,
      pixKey: input.chavePix2,
      isDefaultOfferings: false,
    });
  }

  return first;
}
