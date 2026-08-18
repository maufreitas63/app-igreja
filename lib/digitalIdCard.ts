import { formatCep } from '@/lib/cepUtils';
import { fetchEffectiveSessionProfileRow } from '@/lib/effectiveProfileRpc';
import { normalizeFamilyCode } from '@/lib/family';
import { formatFullName } from '@/lib/fullName';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { resolveSelfiePreviewUrl } from '@/lib/selfie';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean } from '@/lib/supabaseRpc';

export type DigitalIdMembershipStatus = 'Membro' | 'Congregado';

export type DigitalIdCardData = {
  photoUrl: string | null;
  fullName: string;
  initials: string;
  birthDate: string;
  address: string;
  phone: string;
  email: string;
  familyId: string;
  checkInQrValue: string;
  status: DigitalIdMembershipStatus;
  registeredAt: string;
};

const EMPTY_VALUE = '—';

const readString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
};

export const initialsFromFullName = (fullName: string): string => {
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  const first = [...parts[0]][0] ?? '';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? '') : '';

  return `${first}${last}`.toLocaleUpperCase('pt-BR');
};

const formatDateOnly = (value: string): string => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return value;
};

const formatCepDisplay = (value: string): string => {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 8) {
    return formatCep(digits);
  }

  return value;
};

export const formatProfileFullAddress = (profile: Record<string, unknown>): string => {
  const street = readString(profile.address_street);
  const number = readString(profile.address_number);
  const complement = readString(profile.address_complement);
  const neighborhood = readString(profile.address_neighborhood);
  const city = readString(profile.address_city);
  const state = readString(profile.address_state);
  const cep = formatCepDisplay(readString(profile.cep));

  const streetPart = [street, number].filter(Boolean).join(', ');
  const streetWithComplement = [streetPart, complement].filter(Boolean).join(' — ');
  const cityState = [city, state].filter(Boolean).join('/');

  return [streetWithComplement, neighborhood, cityState, cep].filter(Boolean).join(', ');
};

const displayOrDash = (value: string): string => value.trim() || EMPTY_VALUE;

async function loadEffectiveProfileRow(): Promise<Record<string, unknown> | null> {
  const rpcRow = await fetchEffectiveSessionProfileRow();
  const rpcId = readString(rpcRow?.id);

  if (rpcId) {
    return rpcRow;
  }

  const profileId = await resolveEffectiveProfileId({ forceRefresh: true });

  if (!profileId) {
    return null;
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();

  if (error) {
    console.error('Carteirinha Digital: falha ao ler profiles:', error);
    return null;
  }

  return (data as Record<string, unknown> | null) ?? null;
}

async function resolveMembershipStatus(profileId: string): Promise<DigitalIdMembershipStatus> {
  const [memberResult, congregadoResult] = await Promise.all([
    supabase.rpc('profile_has_role_code', {
      p_profile_id: profileId,
      p_role_code: 'member',
    }),
    supabase.rpc('profile_has_role_code', {
      p_profile_id: profileId,
      p_role_code: 'congregado',
    }),
  ]);

  if (memberResult.error) {
    console.error('Carteirinha Digital: profile_has_role_code(member):', memberResult.error);
  }

  if (congregadoResult.error) {
    console.error('Carteirinha Digital: profile_has_role_code(congregado):', congregadoResult.error);
  }

  if (coerceRpcBoolean(memberResult.data)) {
    return 'Membro';
  }

  if (coerceRpcBoolean(congregadoResult.data)) {
    return 'Congregado';
  }

  return 'Congregado';
}

/** Dados da carteirinha do perfil efetivo (Modo Ghost incluso). */
export async function loadDigitalIdCardData(): Promise<DigitalIdCardData | null> {
  const profile = await loadEffectiveProfileRow();
  const profileId = readString(profile?.id);

  if (!profile || !profileId) {
    return null;
  }

  const fullName = formatFullName(readString(profile.full_name));
  const familyId = normalizeFamilyCode(readString(profile.family_id) || readString(profile.codigo_membro));
  const [photoUrl, status] = await Promise.all([
    resolveSelfiePreviewUrl(readString(profile.selfie_url) || null),
    resolveMembershipStatus(profileId),
  ]);

  const birthDateRaw = readString(profile.birth_date);
  const createdAtRaw = readString(profile.created_at);
  const phoneRaw = readString(profile.phone);

  return {
    photoUrl,
    fullName: displayOrDash(fullName),
    initials: initialsFromFullName(fullName),
    birthDate: birthDateRaw ? formatDateOnly(birthDateRaw) : EMPTY_VALUE,
    address: displayOrDash(formatProfileFullAddress(profile)),
    phone: phoneRaw ? formatBrazilPhoneInput(phoneRaw) : EMPTY_VALUE,
    email: displayOrDash(readString(profile.email)),
    familyId: displayOrDash(familyId),
    checkInQrValue: familyId,
    status,
    registeredAt: createdAtRaw ? formatDateOnly(createdAtRaw) : EMPTY_VALUE,
  };
}
