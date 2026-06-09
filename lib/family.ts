import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { supabase } from '@/lib/supabase';

const FALLBACK_FAMILY_PREFIX = 'IBN';

let cachedFamilyIdPrefix: string | null = null;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Prefixo alfanumerico de `app_parameters.parm_entidade` (mesma regra do SQL `get_family_id_prefix`). */
export async function getFamilyIdPrefix(): Promise<string> {
  if (cachedFamilyIdPrefix) {
    return cachedFamilyIdPrefix;
  }

  const { data, error } = await supabase
    .from('app_parameters')
    .select('value')
    .eq('parameter', 'parm_entidade')
    .maybeSingle();

  if (error || !data?.value) {
    cachedFamilyIdPrefix = FALLBACK_FAMILY_PREFIX;
    return cachedFamilyIdPrefix;
  }

  const cleaned = data.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  cachedFamilyIdPrefix = cleaned.length > 0 ? cleaned : FALLBACK_FAMILY_PREFIX;
  return cachedFamilyIdPrefix;
}

/** Invalida o cache (troca de entidade / testes). */
export function clearFamilyIdPrefixCache(): void {
  cachedFamilyIdPrefix = null;
}

export function buildFamilyId(prefix: string, num: number): string {
  return `${prefix}${String(num).padStart(4, '0')}`;
}

/** Valor default exibido antes de carregar `parm_entidade` (fallback IBN). */
export const DEFAULT_FAMILY_ID = `${FALLBACK_FAMILY_PREFIX}0001`;

/** Código familiar canônico (ex.: `ibn0001` → `IBN0001`). */
export const normalizeFamilyCode = (value: string | null | undefined): string =>
  (value ?? '').trim().toUpperCase();

export async function formatFamilyId(num: number): Promise<string> {
  const prefix = await getFamilyIdPrefix();
  return buildFamilyId(prefix, num);
}

const cleanPhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

/** Erro PostgREST quando a coluna `family_id` ainda nao existe em `profiles`. */
export const isMissingFamilyIdColumnError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return message.toLowerCase().includes('family_id');
};

type ProfileFamilyLookup = {
  codigo_membro?: string | null;
  family_id?: string | null;
  full_name?: string | null;
  phone?: string | null;
};

async function normalizeReservedFamilyId(value: unknown, prefix: string): Promise<string | null> {
  const pattern = new RegExp(`^${escapeRegex(prefix)}\\d+$`, 'i');

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    if (pattern.test(trimmedValue)) {
      return trimmedValue.toUpperCase();
    }

    if (/^\d+$/.test(trimmedValue)) {
      return buildFamilyId(prefix, Number.parseInt(trimmedValue, 10));
    }

    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return buildFamilyId(prefix, value);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return normalizeReservedFamilyId(
      record.family_id
      ?? record.next_family_id
      ?? record.reserve_next_family_id
      ?? record.value,
      prefix
    );
  }

  return null;
}

const resolveProfileFamilyValue = (profile: ProfileFamilyLookup | null | undefined) =>
  profile?.family_id ?? profile?.codigo_membro ?? null;

async function getProfileFamilyByPhone(phone: string) {
  const primaryResult = await supabase
    .from('profiles')
    .select('family_id, codigo_membro, full_name')
    .eq('phone', phone)
    .maybeSingle();

  if (!primaryResult.error) {
    return primaryResult.data;
  }

  if (!isMissingFamilyIdColumnError(primaryResult.error)) {
    return null;
  }

  const legacyResult = await supabase
    .from('profiles')
    .select('codigo_membro, full_name')
    .eq('phone', phone)
    .maybeSingle();

  return legacyResult.data;
}

async function getProfileFamilyByAuthUser(authUserId: string) {
  const primaryResult = await supabase
    .from('profiles')
    .select('family_id, codigo_membro, phone, full_name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (!primaryResult.error) {
    return primaryResult.data;
  }

  if (!isMissingFamilyIdColumnError(primaryResult.error)) {
    return null;
  }

  const legacyResult = await supabase
    .from('profiles')
    .select('codigo_membro, phone, full_name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  return legacyResult.data;
}

async function findMemberByPhone(phone: string | null | undefined) {
  if (!phone) {
    return null;
  }

  const { data: exactMatch } = await supabase
    .from('members')
    .select('family_id, full_name')
    .eq('phone', phone)
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .limit(1)
    .maybeSingle();

  if (exactMatch?.family_id) {
    return exactMatch;
  }

  const normalizedPhone = cleanPhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const { data: normalizedMatch } = await supabase
    .from('members')
    .select('family_id, full_name')
    .eq('phone', normalizedPhone)
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .limit(1)
    .maybeSingle();

  return normalizedMatch ?? null;
}

async function findMemberByName(fullName: string | null | undefined) {
  if (!fullName?.trim()) {
    return null;
  }

  const { data } = await supabase
    .from('members')
    .select('family_id, full_name')
    .ilike('full_name', fullName.trim())
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function resolveCurrentFamilyId() {
  const prefix = await getFamilyIdPrefix();

  const { data, error } = await supabase
    .from('app_parameters')
    .select('value')
    .eq('parameter', 'family_ref')
    .maybeSingle();

  if (error || !data?.value) {
    return buildFamilyId(prefix, 1);
  }

  const parsed = Number.parseInt(data.value, 10);
  return Number.isNaN(parsed) ? buildFamilyId(prefix, 1) : buildFamilyId(prefix, parsed);
}

export async function reserveNextFamilyId() {
  const prefix = await getFamilyIdPrefix();

  const reserveResult = await supabase.rpc('reserve_next_family_id');

  if (!reserveResult.error) {
    const reservedFamilyId = await normalizeReservedFamilyId(reserveResult.data, prefix);

    if (reservedFamilyId) {
      return reservedFamilyId;
    }
  }

  const legacyResult = await supabase.rpc('get_next_family_id');

  if (!legacyResult.error) {
    const legacyFamilyId = await normalizeReservedFamilyId(legacyResult.data, prefix);

    if (legacyFamilyId) {
      return legacyFamilyId;
    }
  }

  throw new Error(
    'Nao foi possivel gerar um novo codigo de familia. Execute o script scripts/reserve-next-family-id.sql no Supabase.'
  );
}

export async function resolveFamilyIdForPhone(phone: string | null | undefined) {
  if (!phone) {
    return resolveCurrentFamilyId();
  }

  const profile = await getProfileFamilyByPhone(phone);

  const profileFamilyId = resolveProfileFamilyValue(profile);
  if (profileFamilyId) {
    return normalizeFamilyCode(profileFamilyId);
  }

  const memberByPhone = await findMemberByPhone(phone);
  if (memberByPhone?.family_id) {
    return normalizeFamilyCode(memberByPhone.family_id);
  }

  const memberByName = await findMemberByName(profile?.full_name);
  if (memberByName?.family_id) {
    return normalizeFamilyCode(memberByName.family_id);
  }

  return resolveCurrentFamilyId();
}

export async function resolveFamilyIdForAuthUser(authUserId: string | null | undefined) {
  if (!authUserId) {
    return resolveCurrentFamilyId();
  }

  const profile = await getProfileFamilyByAuthUser(authUserId);

  const profileFamilyId = resolveProfileFamilyValue(profile);
  if (profileFamilyId) {
    return normalizeFamilyCode(profileFamilyId);
  }

  const memberByPhone = await findMemberByPhone(profile?.phone);
  if (memberByPhone?.family_id) {
    return normalizeFamilyCode(memberByPhone.family_id);
  }

  const memberByName = await findMemberByName(profile?.full_name);
  if (memberByName?.family_id) {
    return normalizeFamilyCode(memberByName.family_id);
  }

  return resolveCurrentFamilyId();
}
