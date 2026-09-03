import {
  fetchSessionPixAccounts,
  resolvePixKeyForSlot,
} from '@/lib/pixAccountsApi';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { supabase } from '@/lib/supabase';
import {
  getStoredTenantId,
  listSessionIgrejas,
  resolveActiveIgrejaBranding,
  type SessionIgreja,
} from '@/lib/tenantSession';

export type OfferingsRecipientRow = {
  label: string;
  value: string;
};

export type OfferingsRecipientBundle = {
  recipientRows: OfferingsRecipientRow[];
  pixKey: string | null;
  churchName: string;
};

export function withRecipientInstitution(
  rows: OfferingsRecipientRow[],
  institution: string | null | undefined
): OfferingsRecipientRow[] {
  const value = textOrNull(institution);
  if (!value) {
    return rows;
  }

  return rows.map((row) => (row.label === 'Instituição' ? { ...row, value } : row));
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  corrente: 'Corrente',
  poupanca: 'Poupança',
  pagamento: 'Pagamento',
  salario: 'Salário',
  outro: 'Outro',
};

function upsertRecipientRow(
  rows: OfferingsRecipientRow[],
  label: string,
  value: string | null | undefined
): OfferingsRecipientRow[] {
  const nextValue = textOrNull(value);
  if (!nextValue) {
    return rows;
  }

  const idx = rows.findIndex((row) => row.label === label);
  if (idx >= 0) {
    return rows.map((row, index) => (index === idx ? { ...row, value: nextValue } : row));
  }

  return [...rows, { label, value: nextValue }];
}

export function withRecipientBankAccount(
  rows: OfferingsRecipientRow[],
  account: {
    institution?: string | null;
    label?: string | null;
    holderName?: string | null;
    document?: string | null;
    agency?: string | null;
    accountNumber?: string | null;
    accountType?: string | null;
  } | null | undefined
): OfferingsRecipientRow[] {
  if (!account) {
    return rows;
  }

  let next = withRecipientInstitution(rows, account.institution || account.label);
  next = upsertRecipientRow(next, 'Titular', account.holderName);
  next = upsertRecipientRow(next, 'Agência', account.agency);
  next = upsertRecipientRow(next, 'Conta', account.accountNumber);
  next = upsertRecipientRow(
    next,
    'Tipo',
    account.accountType
      ? ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType
      : null
  );
  return next;
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function buildRows(church: {
  name?: string | null;
  cnpj?: string | null;
  pix_institution?: string | null;
  holder_name?: string | null;
  agency?: string | null;
  account_number?: string | null;
  account_type?: string | null;
}): OfferingsRecipientRow[] {
  const rows: OfferingsRecipientRow[] = [
    { label: 'Para', value: textOrNull(church.name) || '—' },
    { label: 'CNPJ', value: textOrNull(church.cnpj) || '—' },
    { label: 'Instituição', value: textOrNull(church.pix_institution) || '—' },
  ];

  if (textOrNull(church.holder_name)) {
    rows.push({ label: 'Titular', value: church.holder_name as string });
  }
  if (textOrNull(church.agency)) {
    rows.push({ label: 'Agência', value: church.agency as string });
  }
  if (textOrNull(church.account_number)) {
    rows.push({ label: 'Conta', value: church.account_number as string });
  }
  if (textOrNull(church.account_type)) {
    rows.push({ label: 'Tipo', value: church.account_type as string });
  }

  return rows;
}

function bundleFromChurch(church: {
  name?: string | null;
  cnpj?: string | null;
  pix_institution?: string | null;
  pix_key?: string | null;
  holder_name?: string | null;
  agency?: string | null;
  account_number?: string | null;
  account_type?: string | null;
}): OfferingsRecipientBundle {
  return {
    recipientRows: buildRows(church),
    pixKey: textOrNull(church.pix_key),
    churchName: textOrNull(church.name) || '',
  };
}

async function loadOfferingsFromDedicatedRpc(
  tenantId: string | null
): Promise<OfferingsRecipientBundle | null> {
  const { data, error } = await supabase.rpc('get_session_offerings_recipient', {
    p_tenant_id: tenantId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_session_offerings_recipient')) {
      return null;
    }
    console.warn('get_session_offerings_recipient:', error.message);
    return null;
  }

  if (!data || typeof data !== 'object' || (data as { success?: boolean }).success !== true) {
    return null;
  }

  const row = data as Record<string, unknown>;
  return bundleFromChurch({
    name: textOrNull(row.name),
    cnpj: textOrNull(row.cnpj),
    pix_institution: textOrNull(row.pix_institution),
    pix_key: textOrNull(row.pix_key),
    holder_name: textOrNull(row.holder_name),
    agency: textOrNull(row.agency),
    account_number: textOrNull(row.account_number),
    account_type: textOrNull(row.account_type),
  });
}

async function resolveActiveChurchForOfferings(): Promise<SessionIgreja | null> {
  const branding = await resolveActiveIgrejaBranding();
  const tenantId = (await getStoredTenantId()) || branding?.id || null;

  try {
    const churches = await listSessionIgrejas();
    return (
      (tenantId ? churches.find((church) => church.id === tenantId) : null)
      ?? churches.find((church) => church.is_primary)
      ?? churches[0]
      ?? null
    );
  } catch {
    if (!branding) {
      return null;
    }
    return {
      id: branding.id,
      code: branding.code,
      name: branding.name,
      logo_url: branding.logo_url,
      website_url: null,
      instagram_url: null,
      youtube_url: null,
      cnpj: null,
      pix_institution: null,
      pix_key: null,
      pix_key_secundaria: null,
      pix_institution_secundaria: null,
      is_active: true,
      is_primary: true,
      is_linked: true,
      mae_tenant_id: null,
      mae_code: null,
      mae_name: null,
    };
  }
}

async function preferInstancePixKey(fallback: string | null): Promise<string | null> {
  try {
    const accounts = await fetchSessionPixAccounts();
    return resolvePixKeyForSlot(accounts, accounts.defaultId, fallback);
  } catch {
    return textOrNull(fallback);
  }
}

/** Dados do recebedor + PIX da instância ativa. */
export async function loadOfferingsRecipientBundle(): Promise<OfferingsRecipientBundle> {
  const branding = await resolveActiveIgrejaBranding();
  const tenantId = (await getStoredTenantId()) || branding?.id || null;

  try {
    const fromRpc = await loadOfferingsFromDedicatedRpc(tenantId);
    if (fromRpc) {
      return {
        ...fromRpc,
        pixKey: fromRpc.pixKey || (await preferInstancePixKey(fromRpc.pixKey)),
      };
    }
  } catch (error) {
    console.warn('offerings dedicated rpc:', error);
  }

  const church = await resolveActiveChurchForOfferings();
  if (!church) {
    return {
      recipientRows: [
        { label: 'Para', value: '—' },
        { label: 'CNPJ', value: '—' },
        { label: 'Instituição', value: '—' },
      ],
      pixKey: await preferInstancePixKey(null),
      churchName: '',
    };
  }

  const bundle = bundleFromChurch(church);
  return {
    ...bundle,
    pixKey: await preferInstancePixKey(bundle.pixKey),
  };
}
