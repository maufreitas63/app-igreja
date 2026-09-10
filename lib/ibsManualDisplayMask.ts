import { formatFullName, normalizeFullNameKey } from '@/lib/fullName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { canonicalPhoneDigits } from '@/lib/phoneDigits';
import { fetchSessionMapGeolocalizacaoSettings } from '@/lib/profileMapAcl';
import { supabase } from '@/lib/supabase';
import { formatPhoneForDisplay } from '@/lib/totemDevice';
import {
  getStoredActiveIgrejaBranding,
  getStoredTenantId,
  subscribeActiveTenantChange,
} from '@/lib/tenantSession';

/** Instância IBS — máscara só na UI, para manuais. */
export const IBS_MANUAL_MASK_TENANT_ID = '81295e39-9167-40b4-a524-702439905e75';
export const IBS_MANUAL_DISPLAY_NAME = 'Admin';
export const IBS_MANUAL_DISPLAY_PHONE = '19 998989898';

const saProfileIds = new Set<string>();
const saNameKeys = new Set<string>();
const saPhoneDigits = new Set<string>();

let activeIsIbs = false;
let started = false;
let refreshInFlight: Promise<void> | null = null;

const shortNameKey = (fullName: string) => {
  const trimmed = formatFullName(fullName);
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const short =
    parts.length <= 1 ? (parts[0] ?? trimmed) : `${parts[0]} ${parts[parts.length - 1]}`;
  return normalizeFullNameKey(short);
};

const rememberName = (fullName: string | null | undefined) => {
  const formatted = formatFullName(fullName);
  if (!formatted) {
    return;
  }

  saNameKeys.add(normalizeFullNameKey(formatted));
  saNameKeys.add(shortNameKey(formatted));
};

const rememberPhone = (phone: string | null | undefined) => {
  const digits = canonicalPhoneDigits(phone);
  if (digits) {
    saPhoneDigits.add(digits);
  }
};

export const rememberIbsSuperAdminProfile = (profile: {
  id?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  phone?: string | null;
}) => {
  if (!activeIsIbs) {
    return;
  }

  const id = profile.id?.trim();
  if (id) {
    saProfileIds.add(id);
  }

  rememberName(profile.full_name ?? profile.fullName);
  rememberPhone(profile.phone);
};

const nameLooksLikeMaskedSuperAdmin = (fullName: string | null | undefined) => {
  const formatted = formatFullName(fullName);
  if (!formatted) {
    return false;
  }

  const key = normalizeFullNameKey(formatted);
  return saNameKeys.has(key) || saNameKeys.has(shortNameKey(formatted));
};

export const shouldMaskIbsSuperAdminDisplay = (options?: {
  profileId?: string | null;
  fullName?: string | null;
  phone?: string | null;
}) => {
  if (!activeIsIbs) {
    return false;
  }

  const profileId = options?.profileId?.trim();
  if (profileId && saProfileIds.has(profileId)) {
    return true;
  }

  const phoneDigits = canonicalPhoneDigits(options?.phone);
  if (phoneDigits && saPhoneDigits.has(phoneDigits)) {
    return true;
  }

  return nameLooksLikeMaskedSuperAdmin(options?.fullName);
};

export const applyIbsManualDisplayName = (
  fullName: string | null | undefined,
  profileId?: string | null
) => {
  if (shouldMaskIbsSuperAdminDisplay({ profileId, fullName })) {
    return IBS_MANUAL_DISPLAY_NAME;
  }

  return formatFullName(fullName);
};

export const applyIbsManualDisplayPhone = (
  phone: string | null | undefined,
  profileId?: string | null
) => {
  if (shouldMaskIbsSuperAdminDisplay({ profileId, phone })) {
    return IBS_MANUAL_DISPLAY_PHONE;
  }

  return null;
};

/** Telefone para UI. Não usar em formulários nem persistência. */
export const formatIbsManualUiPhone = (
  phone: string | null | undefined,
  profileId?: string | null
) => {
  const masked = applyIbsManualDisplayPhone(phone, profileId);
  if (masked) {
    return masked;
  }

  const raw = phone?.trim() ?? '';
  return raw ? formatPhoneForDisplay(phone as string) : '';
};

const EMPTY_FIELD_DISPLAY = new Set(['', '—', 'Sem valor', 'não cadastrado', 'sem celular cadastrado']);

/** Valor de campo cadastral só para leitura na UI. */
export const formatIbsManualFieldDisplay = (
  key: string,
  value: string | null | undefined,
  profileId?: string | null
) => {
  const trimmed = value?.trim() ?? '';

  if (EMPTY_FIELD_DISPLAY.has(trimmed)) {
    return value ?? '';
  }

  if (key === 'full_name') {
    return applyIbsManualDisplayName(value, profileId);
  }

  if (key === 'phone' || key.includes('phone')) {
    return formatIbsManualUiPhone(value, profileId);
  }

  return trimmed;
};

export async function refreshIbsManualDisplayMask() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const [branding, tenantId] = await Promise.all([
      getStoredActiveIgrejaBranding(),
      getStoredTenantId(),
    ]);

    activeIsIbs =
      (branding?.code ?? '').trim().toUpperCase() === 'IBS'
      || tenantId === IBS_MANUAL_MASK_TENANT_ID
      || branding?.id === IBS_MANUAL_MASK_TENANT_ID;

    saProfileIds.clear();
    saNameKeys.clear();
    saPhoneDigits.clear();

    if (!activeIsIbs) {
      return;
    }

    const [sessionProfile, geoSettings] = await Promise.all([
      loadEffectiveSessionProfile().catch(() => null),
      fetchSessionMapGeolocalizacaoSettings().catch(() => null),
    ]);

    const geoIds = [...(geoSettings?.superAdminIds ?? [])]
      .map((id) => id.trim())
      .filter(Boolean);
    geoIds.forEach((id) => saProfileIds.add(id));

    if (sessionProfile?.id && saProfileIds.has(sessionProfile.id)) {
      rememberIbsSuperAdminProfile({
        id: sessionProfile.id,
        full_name: sessionProfile.full_name,
        phone: sessionProfile.phone,
      });
    }

    const uniqueIds = [...saProfileIds];
    if (uniqueIds.length === 0) {
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', uniqueIds);

    if (error || !data) {
      return;
    }

    for (const row of data) {
      rememberIbsSuperAdminProfile({
        id: String(row.id ?? ''),
        full_name: row.full_name,
        phone: row.phone,
      });
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function ensureIbsManualDisplayMaskStarted() {
  if (started) {
    return;
  }

  started = true;
  subscribeActiveTenantChange(() => {
    void refreshIbsManualDisplayMask();
  });
  void refreshIbsManualDisplayMask();
}
