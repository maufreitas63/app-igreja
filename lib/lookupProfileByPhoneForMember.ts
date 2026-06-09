import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';

export type ProfileMemberLookup = {
  id: string;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  family_id: string | null;
};

const PROFILE_MEMBER_LOOKUP_SELECT = 'id, full_name, phone, birth_date, family_id, codigo_membro';

const MIN_PHONE_DIGITS_TO_SEARCH = 10;
const MIN_NAME_CHARS_TO_SEARCH = 2;
const DEFAULT_NAME_SEARCH_LIMIT = 20;

export const canSearchProfileByPhone = (phoneInput: string) =>
  phoneInput.replace(/\D/g, '').length >= MIN_PHONE_DIGITS_TO_SEARCH;

export const canSearchProfileByName = (nameInput: string) =>
  nameInput.trim().length >= MIN_NAME_CHARS_TO_SEARCH;

/** Perfil já vinculado ao código familiar atual (family_id ou codigo_membro). */
export const profileBelongsToFamily = (
  profile: Pick<ProfileMemberLookup, 'family_id'>,
  familyId: string
): boolean => {
  const target = familyId.trim();
  const profileFamily = profile.family_id?.trim() ?? '';
  return Boolean(target && profileFamily && profileFamily === target);
};

export const buildProfileInFamilyMessage = (profile: ProfileMemberLookup) => {
  const name = profile.full_name?.trim() || 'Este usuário';
  return `${name} já faz parte desta família.`;
};

const mapProfileMemberLookupRow = (row: {
  id?: string;
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  family_id?: string | null;
  codigo_membro?: string | null;
}): ProfileMemberLookup | null => {
  if (!row.id) {
    return null;
  }

  return {
    id: String(row.id),
    full_name: row.full_name ?? null,
    phone: row.phone ?? null,
    birth_date: row.birth_date ?? null,
    family_id: (row.family_id ?? row.codigo_membro ?? null) as string | null,
  };
};

/** Busca perfis em `profiles` pelo nome completo (busca parcial, case-insensitive). */
export async function searchProfilesByNameForMember(
  nameInput: string,
  limit = DEFAULT_NAME_SEARCH_LIMIT
): Promise<ProfileMemberLookup[]> {
  const normalized = nameInput.trim();

  if (!canSearchProfileByName(normalized)) {
    return [];
  }

  const pattern = `%${normalized.replace(/[%_]/g, '')}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_MEMBER_LOOKUP_SELECT)
    .not('full_name', 'is', null)
    .neq('full_name', '')
    .ilike('full_name', pattern)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapProfileMemberLookupRow(row))
    .filter((row): row is ProfileMemberLookup => row !== null);
}

export async function lookupProfileByPhoneForMember(
  phoneInput: string
): Promise<ProfileMemberLookup | null> {
  const variants = buildPhoneDbQueryVariants(phoneInput);
  if (!canSearchProfileByPhone(phoneInput) || !variants.length) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_MEMBER_LOOKUP_SELECT)
    .in('phone', variants)
    .limit(1);

  if (error) {
    throw error;
  }

  const row = data?.[0];
  if (!row?.id) {
    return null;
  }

  return mapProfileMemberLookupRow(row);
}
