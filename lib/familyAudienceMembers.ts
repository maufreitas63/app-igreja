import type { FamilyMember } from '@/hooks/useFamilyMembers';
import { compareFamilyMembersByRelationship } from '@/lib/familyRelationshipOptions';
import { normalizeFamilyCode } from '@/lib/family';
import { formatFullName, normalizeFullNameKey } from '@/lib/fullName';
import { isFamilyAudienceMember, MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { applyProfileBirthDates } from '@/lib/profileBirthDates';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { resolveActiveSessionMember } from '@/lib/resolveActiveSessionMember';
import { upsertFamilyMember } from '@/lib/upsertFamilyMember';
import { supabase } from '@/lib/supabase';

export type SessionProfileAudience = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  family_id?: string | null;
};

const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const memberDedupKey = (member: Pick<FamilyMember, 'id' | 'full_name' | 'phone'>) => {
  const phone = normalizePhone(member.phone);

  if (phone.length >= 10) {
    return `phone:${phone}`;
  }

  const name = normalizeFullNameKey(member.full_name);

  if (name) {
    return `name:${name}`;
  }

  return `id:${member.id}`;
};

const pickPreferredMember = (current: FamilyMember, candidate: FamilyMember) => {
  const currentAccepted = current.accepted === true;
  const candidateAccepted = candidate.accepted === true;

  if (candidateAccepted !== currentAccepted) {
    return candidateAccepted ? candidate : current;
  }

  const currentPhone = normalizePhone(current.phone).length;
  const candidatePhone = normalizePhone(candidate.phone).length;

  if (candidatePhone > currentPhone) {
    return candidate;
  }

  if (currentPhone > candidatePhone) {
    return current;
  }

  if (!current.birth_date && candidate.birth_date) {
    return candidate;
  }

  if (!candidate.birth_date && current.birth_date) {
    return current;
  }

  const currentCreatedAt = Date.parse(current.created_at ?? '');
  const candidateCreatedAt = Date.parse(candidate.created_at ?? '');

  if (Number.isFinite(candidateCreatedAt) && Number.isFinite(currentCreatedAt)) {
    return candidateCreatedAt > currentCreatedAt ? candidate : current;
  }

  return current;
};

/** Remove duplicatas (mesmo telefone ou mesmo nome na família). */
export function dedupeFamilyMembers(members: FamilyMember[]): FamilyMember[] {
  const merged = new Map<string, FamilyMember>();

  for (const member of members) {
    const key = memberDedupKey(member);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, member);
      continue;
    }

    merged.set(key, pickPreferredMember(existing, member));
  }

  return Array.from(merged.values()).sort(compareFamilyMembersByRelationship);
}

const mapAudienceMemberRows = (rows: FamilyMember[]) =>
  rows
    .filter((member) => isFamilyAudienceMember(member.accepted))
    .map((member) => ({
      ...member,
      full_name: formatFullName(member.full_name),
      family_id: normalizeFamilyCode(member.family_id),
    }));

const isMissingRpcError = (error: { message?: string } | null, rpcName: string) => {
  const message = (error?.message ?? '').toLowerCase();

  return (
    message.includes(rpcName.toLowerCase())
    && (message.includes('could not find') || message.includes('does not exist'))
  );
};

const mergeAudienceMemberSources = (...sources: FamilyMember[][]) => {
  const merged = new Map<string, FamilyMember>();

  for (const source of sources) {
    for (const member of source) {
      const memberId = String(member.id ?? '').trim();

      if (!memberId) {
        continue;
      }

      const existing = merged.get(memberId);
      merged.set(memberId, existing ? pickPreferredMember(existing, member) : member);
    }
  }

  return Array.from(merged.values());
};

const mapAudienceRpcMemberRow = (row: Record<string, unknown>): FamilyMember | null => {
  const memberId = String(row.member_id ?? row.id ?? '').trim();
  const fullName = formatFullName(String(row.full_name ?? ''));

  if (!memberId || !fullName) {
    return null;
  }

  return {
    id: memberId,
    full_name: fullName,
    phone: row.phone != null ? String(row.phone).trim() || null : null,
    birth_date: row.birth_date != null ? String(row.birth_date) : null,
    relationship: row.relationship != null ? String(row.relationship).trim() || null : null,
    family_id: normalizeFamilyCode(String(row.family_id ?? '')),
    accepted: typeof row.accepted === 'boolean' ? row.accepted : row.accepted == null ? null : Boolean(row.accepted),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
};

const fetchMembersDirectFromTable = async (familyId: string): Promise<FamilyMember[]> => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .ilike('family_id', familyId)
    .order('full_name');

  if (error) {
    throw error;
  }

  return (data as FamilyMember[]) ?? [];
};

const fetchMembersByIds = async (memberIds: string[]): Promise<FamilyMember[]> => {
  if (!memberIds.length) {
    return [];
  }

  const { data, error } = await supabase.from('members').select('*').in('id', memberIds);

  if (error) {
    throw error;
  }

  return (data as FamilyMember[]) ?? [];
};

const fetchMembersFromDirectoryRpc = async (familyId: string): Promise<FamilyMember[]> => {
  const { data: rpcData, error: rpcError } = await supabase.rpc('list_members_family_directory', {
    p_family_id: familyId,
  });

  if (rpcError) {
    if (isMissingRpcError(rpcError, 'list_members_family_directory')) {
      return [];
    }

    throw rpcError;
  }

  if (!Array.isArray(rpcData) || !rpcData.length) {
    return [];
  }

  const memberIds = rpcData
    .map((row) => String((row as { member_id?: string }).member_id ?? '').trim())
    .filter(Boolean);

  if (!memberIds.length) {
    return [];
  }

  return fetchMembersByIds(memberIds);
};

const fetchMembersFromAudienceRpc = async (familyId: string): Promise<FamilyMember[]> => {
  const { data, error } = await supabase.rpc('list_family_event_audience_members', {
    p_family_id: familyId,
  });

  if (error) {
    if (isMissingRpcError(error, 'list_family_event_audience_members')) {
      return [];
    }

    throw error;
  }

  return (data as Array<Record<string, unknown>> | null ?? [])
    .map((row) => mapAudienceRpcMemberRow(row))
    .filter((row): row is FamilyMember => row !== null);
};

const memberMatchesAudienceProfile = (
  member: Pick<FamilyMember, 'full_name' | 'phone'>,
  profile: { full_name?: string | null; phone?: string | null }
) => {
  const profilePhoneVariants = buildPhoneDbQueryVariants(profile.phone ?? '');
  const memberPhone = member.phone?.trim() ?? '';
  const normalizedMemberPhone = normalizePhone(member.phone);

  if (
    profilePhoneVariants.some(
      (variant) => variant === memberPhone || normalizePhone(variant) === normalizedMemberPhone
    )
  ) {
    return true;
  }

  const profileName = normalizeFullNameKey(profile.full_name);

  return Boolean(profileName && normalizeFullNameKey(member.full_name) === profileName);
};

const supplementAudienceFromFamilyProfiles = async (
  familyId: string,
  members: FamilyMember[]
): Promise<FamilyMember[]> => {
  const { data, error } = await supabase.rpc('list_family_profiles_for_event_audience', {
    p_family_id: familyId,
  });

  if (error) {
    if (isMissingRpcError(error, 'list_family_profiles_for_event_audience')) {
      return members;
    }

    throw error;
  }

  const profiles = (data as Array<Record<string, unknown>> | null) ?? [];
  const supplemented = [...members];

  for (const row of profiles) {
    const fullName = formatFullName(String(row.full_name ?? ''));

    if (!fullName) {
      continue;
    }

    const profile = {
      full_name: fullName,
      phone: row.phone != null ? String(row.phone).trim() || null : null,
      birth_date: row.birth_date != null ? String(row.birth_date) : null,
    };

    if (members.some((member) => memberMatchesAudienceProfile(member, profile))) {
      continue;
    }

    try {
      const { id: memberId } = await upsertFamilyMember({
        full_name: fullName,
        phone: profile.phone,
        birth_date: profile.birth_date,
        relationship: 'Outros',
        family_id: familyId,
        accepted: MEMBER_ACCEPTED_VALUE,
      });

      if (!memberId) {
        continue;
      }

      const { data: insertedMember, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .maybeSingle();

      if (fetchError || !insertedMember) {
        continue;
      }

      supplemented.push(insertedMember as FamilyMember);
    } catch {
      // Mantém a audiência utilizável mesmo se o upsert falhar para um integrante.
    }
  }

  return supplemented;
};

/** Lista integrantes da família para audiência (inclui dependentes com accepted null ou true). */
export async function fetchFamilyAudienceMembers(familyId: string): Promise<FamilyMember[]> {
  const normalizedFamilyId = normalizeFamilyCode(familyId);

  if (!normalizedFamilyId) {
    return [];
  }

  const [directRows, audienceRpcRows, directoryRpcRows] = await Promise.all([
    fetchMembersDirectFromTable(normalizedFamilyId),
    fetchMembersFromAudienceRpc(normalizedFamilyId),
    fetchMembersFromDirectoryRpc(normalizedFamilyId),
  ]);

  const merged = mergeAudienceMemberSources(directRows, audienceRpcRows, directoryRpcRows);
  const supplemented = await supplementAudienceFromFamilyProfiles(normalizedFamilyId, merged);
  const normalized = mapAudienceMemberRows(supplemented);

  return applyProfileBirthDates(normalized);
}

const memberMatchesSessionProfile = (
  member: FamilyMember,
  sessionProfile: SessionProfileAudience,
  sessionProfileName?: string | null
) => {
  const sessionPhoneVariants = buildPhoneDbQueryVariants(sessionProfile.phone ?? '');
  const memberPhone = member.phone?.trim() ?? '';
  const normalizedMemberPhone = normalizePhone(member.phone);

  if (
    sessionPhoneVariants.some(
      (variant) => variant === memberPhone || normalizePhone(variant) === normalizedMemberPhone
    )
  ) {
    return true;
  }

  const sessionName = normalizeFullNameKey(sessionProfile.full_name ?? sessionProfileName);

  if (sessionName && normalizeFullNameKey(member.full_name) === sessionName) {
    return true;
  }

  return false;
};

/**
 * Garante que o perfil da sessão exista em `members` (aceito) para aparecer na audiência.
 */
export async function ensureSessionFamilyMemberRecord(
  familyId: string,
  sessionProfile: SessionProfileAudience,
  sessionProfileName?: string | null
): Promise<boolean> {
  const normalizedFamilyId = normalizeFamilyCode(familyId);

  if (!normalizedFamilyId || !sessionProfile.id) {
    return false;
  }

  const displayName =
    formatFullName(sessionProfile.full_name ?? sessionProfileName) || 'Participante';

  const { data: familyMembers, error: fetchError } = await supabase
    .from('members')
    .select('id, full_name, phone, birth_date, relationship, family_id, accepted')
    .ilike('family_id', normalizedFamilyId);

  if (fetchError) {
    throw fetchError;
  }

  const members = mapAudienceMemberRows((familyMembers as FamilyMember[] | null) ?? []);

  if (
    resolveActiveSessionMember(members, {
      sessionPhone: sessionProfile.phone,
      sessionProfileName: sessionProfile.full_name ?? sessionProfileName,
    })
    || members.some((member) => memberMatchesSessionProfile(member, sessionProfile, sessionProfileName))
  ) {
    return false;
  }

  const { id: memberId } = await upsertFamilyMember({
    full_name: displayName,
    phone: sessionProfile.phone?.trim() || null,
    birth_date: sessionProfile.birth_date ?? null,
    relationship: 'Outros',
    family_id: normalizedFamilyId,
    accepted: MEMBER_ACCEPTED_VALUE,
  });

  return Boolean(memberId);
}

