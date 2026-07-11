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

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function buildRows(church: {
  name?: string | null;
  cnpj?: string | null;
  pix_institution?: string | null;
}): OfferingsRecipientRow[] {
  return [
    { label: 'Para', value: textOrNull(church.name) || '—' },
    { label: 'CNPJ', value: textOrNull(church.cnpj) || '—' },
    { label: 'Instituição', value: textOrNull(church.pix_institution) || '—' },
  ];
}

function bundleFromChurch(church: {
  name?: string | null;
  cnpj?: string | null;
  pix_institution?: string | null;
  pix_key?: string | null;
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
      is_active: true,
      is_primary: true,
      is_linked: true,
    };
  }
}

/** Dados do recebedor + PIX da instância ativa. */
export async function loadOfferingsRecipientBundle(): Promise<OfferingsRecipientBundle> {
  const branding = await resolveActiveIgrejaBranding();
  const tenantId = (await getStoredTenantId()) || branding?.id || null;

  try {
    const fromRpc = await loadOfferingsFromDedicatedRpc(tenantId);
    if (fromRpc) {
      return fromRpc;
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
      pixKey: null,
      churchName: '',
    };
  }

  return bundleFromChurch(church);
}
