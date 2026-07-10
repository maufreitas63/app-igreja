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

function buildRows(church: Pick<SessionIgreja, 'name' | 'cnpj' | 'pix_institution'>): OfferingsRecipientRow[] {
  return [
    { label: 'Para', value: church.name.trim() || '—' },
    { label: 'CNPJ', value: church.cnpj?.trim() || '—' },
    { label: 'Instituição', value: church.pix_institution?.trim() || '—' },
  ];
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

  return {
    recipientRows: buildRows(church),
    pixKey: church.pix_key?.trim() || null,
    churchName: church.name.trim(),
  };
}
