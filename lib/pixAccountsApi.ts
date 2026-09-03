/**
 * Contas Pix da instância (chave_pix + chave_pix_secundaria).
 * SQL: scripts/pix-multiple-accounts.sql
 */

import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PIX_ACCOUNTS_SQL_HINT = 'Execute no Supabase: scripts/pix-multiple-accounts.sql';

export type PixAccountSlot = '1' | '2';

export type PixAccount = {
  slot: PixAccountSlot;
  label: string;
  pixKey: string | null;
  institution: string | null;
};

export type PixAccountsBundle = {
  defaultSlot: PixAccountSlot;
  accounts: PixAccount[];
  canManage: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export function normalizePixAccountSlot(value: unknown): PixAccountSlot {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  return raw === '2' || raw === 'secundaria' || raw === 'chave_pix_secundaria' ? '2' : '1';
}

function textOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function parseAccount(value: unknown): PixAccount | null {
  const row = asRecord(value);
  const slot = normalizePixAccountSlot(row.slot);
  const label = textOrNull(row.label) || (slot === '2' ? 'Conta secundária' : 'Conta principal');

  return {
    slot,
    label,
    pixKey: textOrNull(row.pix_key),
    institution: textOrNull(row.institution) || textOrNull(row.pix_institution) || label,
  };
}

function emptyBundle(): PixAccountsBundle {
  return {
    defaultSlot: '1',
    canManage: false,
    accounts: [
      { slot: '1', label: 'Conta principal', pixKey: null, institution: null },
      { slot: '2', label: 'Conta secundária', pixKey: null, institution: null },
    ],
  };
}

function parseBundle(payload: Record<string, unknown>): PixAccountsBundle {
  const accounts = Array.isArray(payload.accounts)
    ? payload.accounts.map(parseAccount).filter((row): row is PixAccount => row !== null)
    : [];
  const fallback = emptyBundle();

  return {
    defaultSlot: normalizePixAccountSlot(payload.default_slot ?? payload.pix_default_slot),
    canManage: payload.can_manage === true,
    accounts: fallback.accounts.map(
      (item) => accounts.find((account) => account.slot === item.slot) ?? item
    ),
  };
}

export function pixAccountBySlot(
  bundle: PixAccountsBundle | null | undefined,
  slot: unknown
): PixAccount | null {
  if (!bundle) {
    return null;
  }

  const normalized = normalizePixAccountSlot(slot);
  return bundle.accounts.find((account) => account.slot === normalized) ?? null;
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

  const other = pixAccountBySlot(bundle, normalizePixAccountSlot(slot) === '2' ? '1' : '2')?.pixKey;
  return other ?? textOrNull(fallback);
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
  return (bundle?.accounts ?? emptyBundle().accounts).map((account) => ({
    value: account.slot,
    label: account.pixKey
      ? `${account.label} · ${account.slot === '1' ? 'conta 1' : 'conta 2'}`
      : `${account.label} (sem chave)`,
  }));
}

export async function fetchSessionPixAccounts(): Promise<PixAccountsBundle> {
  const { data, error } = await supabase.rpc('get_session_pix_accounts');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_session_pix_accounts')) {
      throw new Error(PIX_ACCOUNTS_SQL_HINT);
    }

    throw new Error(error.message || 'Falha ao carregar contas Pix.');
  }

  const payload = asRecord(data);

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Sem permissão para contas Pix.'));
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
  const { data, error } = await supabase.rpc('salvar_pix_accounts_admin', {
    p_nome_conta_1: input.nomeConta1,
    p_chave_pix_1: input.chavePix1,
    p_nome_conta_2: input.nomeConta2,
    p_chave_pix_2: input.chavePix2,
    p_padrao_ofertas: input.padraoOfertas,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'salvar_pix_accounts_admin')) {
      throw new Error(PIX_ACCOUNTS_SQL_HINT);
    }

    throw new Error(error.message || 'Falha ao salvar contas Pix.');
  }

  const payload = asRecord(data);

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Não foi possível salvar as contas Pix.'));
  }

  return parseBundle(payload);
}
