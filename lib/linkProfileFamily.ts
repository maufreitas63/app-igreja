import { buildFamilyId, getFamilyIdPrefix } from '@/lib/family';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';

type ProfileForFamilyLink = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
};

export async function normalizeFamilyLinkInput(input: string): Promise<string | null> {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) {
    return null;
  }

  const prefix = await getFamilyIdPrefix();
  const pattern = new RegExp(`^${prefix}\\d+$`, 'i');

  if (pattern.test(trimmed)) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return buildFamilyId(prefix, Number.parseInt(trimmed, 10));
  }

  return null;
}

export async function familyGroupExists(familyId: string): Promise<boolean> {
  const { count: membersCount, error: membersError } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('accepted', MEMBER_ACCEPTED_VALUE);

  if (membersError) {
    throw membersError;
  }

  if ((membersCount ?? 0) > 0) {
    return true;
  }

  const { count: profilesCount, error: profilesError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId);

  if (profilesError && !profilesError.message.toLowerCase().includes('family_id')) {
    throw profilesError;
  }

  if ((profilesCount ?? 0) > 0) {
    return true;
  }

  const { count: legacyCount, error: legacyError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('codigo_membro', familyId);

  if (legacyError) {
    throw legacyError;
  }

  return (legacyCount ?? 0) > 0;
}

async function updateProfileFamilyId(profileId: string, familyId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({
      family_id: familyId,
      codigo_membro: familyId,
    })
    .eq('id', profileId);

  if (error?.message.toLowerCase().includes('family_id')) {
    const { error: legacyError } = await supabase
      .from('profiles')
      .update({ codigo_membro: familyId })
      .eq('id', profileId);

    if (legacyError) {
      throw legacyError;
    }

    return;
  }

  if (error) {
    throw error;
  }
}

async function ensureRepresentativeMember(profile: ProfileForFamilyLink, familyId: string) {
  const fullName = profile.full_name?.trim();
  if (!fullName) {
    return;
  }

  const phoneAttempt = profile.phone?.trim() || null;
  const phoneVariants = phoneAttempt ? buildPhoneDbQueryVariants(phoneAttempt) : [];

  let existing: { id: string } | null = null;

  if (phoneVariants.length) {
    const { data: byPhone } = await supabase
      .from('members')
      .select('id')
      .eq('family_id', familyId)
      .in('phone', phoneVariants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    existing = byPhone;
  }

  if (!existing?.id) {
    const { data: byName } = await supabase
      .from('members')
      .select('id')
      .eq('family_id', familyId)
      .eq('full_name', fullName)
      .maybeSingle();

    existing = byName;
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('members')
      .update({
        family_id: familyId,
        full_name: fullName,
        phone: profile.phone?.trim() || null,
        birth_date: profile.birth_date ?? null,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const { error: insertError } = await supabase.from('members').insert({
    full_name: fullName,
    phone: profile.phone?.trim() || null,
    birth_date: profile.birth_date ?? null,
    relationship: 'Representante Legal',
    family_id: familyId,
  });

  if (insertError) {
    throw insertError;
  }
}

export async function searchFamilyByInput(rawFamilyInput: string) {
  const familyId = await normalizeFamilyLinkInput(rawFamilyInput);

  if (!familyId) {
    throw new Error('Informe um código de família válido (ex.: IBN0001).');
  }

  const exists = await familyGroupExists(familyId);

  if (!exists) {
    throw new Error('Nenhuma família encontrada com este código. Confira o nome/código informado.');
  }

  return familyId;
}

const MIN_FAMILY_NAME_SEARCH_CHARS = 2;
const DEFAULT_FAMILY_NAME_SEARCH_LIMIT = 20;

export type FamilySearchByNameResult = {
  key: string;
  fullName: string;
  phone: string | null;
  familyId: string;
};

export const canSearchFamilyByMemberName = (query: string) =>
  query.trim().length >= MIN_FAMILY_NAME_SEARCH_CHARS;

const resolveRowFamilyId = (row: {
  family_id?: string | null;
  codigo_membro?: string | null;
}): string | null => {
  const familyId = (row.family_id ?? row.codigo_membro ?? '').trim().toUpperCase();
  return familyId || null;
};

const buildFamilyNameSearchKey = (
  fullName: string,
  familyId: string,
  phone: string | null | undefined
) => `${familyId}::${fullName.trim().toLowerCase()}::${(phone ?? '').replace(/\D/g, '')}`;

/** Busca famílias pelo nome de um membro (perfis e membros aceitos). */
export async function searchFamiliesByMemberName(
  query: string,
  limit = DEFAULT_FAMILY_NAME_SEARCH_LIMIT
): Promise<FamilySearchByNameResult[]> {
  const normalized = query.trim();

  if (!canSearchFamilyByMemberName(normalized)) {
    return [];
  }

  const pattern = `%${normalized.replace(/[%_]/g, '')}%`;
  const merged = new Map<string, FamilySearchByNameResult>();

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, phone, family_id, codigo_membro')
    .not('full_name', 'is', null)
    .neq('full_name', '')
    .ilike('full_name', pattern)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (profileError) {
    throw profileError;
  }

  for (const row of profileRows ?? []) {
    const fullName = row.full_name?.trim();
    const familyId = resolveRowFamilyId(row);

    if (!fullName || !familyId) {
      continue;
    }

    const phone = row.phone?.trim() || null;
    const key = buildFamilyNameSearchKey(fullName, familyId, phone);

    merged.set(key, {
      key,
      fullName,
      phone,
      familyId,
    });
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .select('full_name, phone, family_id')
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .not('full_name', 'is', null)
    .neq('full_name', '')
    .ilike('full_name', pattern)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (memberError) {
    throw memberError;
  }

  for (const row of memberRows ?? []) {
    const fullName = row.full_name?.trim();
    const familyId = resolveRowFamilyId(row);

    if (!fullName || !familyId) {
      continue;
    }

    const phone = row.phone?.trim() || null;
    const key = buildFamilyNameSearchKey(fullName, familyId, phone);

    if (!merged.has(key)) {
      merged.set(key, {
        key,
        fullName,
        phone,
        familyId,
      });
    }
  }

  return Array.from(merged.values())
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'pt-BR'))
    .slice(0, limit);
}

export async function linkProfileToFamilyById(profile: ProfileForFamilyLink, familyId: string) {
  const normalizedFamilyId = familyId.trim().toUpperCase();

  if (!normalizedFamilyId) {
    throw new Error('Família inválida para vínculo.');
  }

  const exists = await familyGroupExists(normalizedFamilyId);

  if (!exists) {
    throw new Error('Nenhuma família encontrada para o membro selecionado.');
  }

  await updateProfileFamilyId(profile.id, normalizedFamilyId);
  await ensureRepresentativeMember(profile, normalizedFamilyId);

  return normalizedFamilyId;
}

export async function linkProfileToFamily(profile: ProfileForFamilyLink, rawFamilyInput: string) {
  const familyId = await searchFamilyByInput(rawFamilyInput);
  return linkProfileToFamilyById(profile, familyId);
}
