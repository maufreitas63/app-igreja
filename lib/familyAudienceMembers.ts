import type { FamilyMember } from '@/hooks/useFamilyMembers';
import { normalizeFamilyCode } from '@/lib/family';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { resolveActiveSessionMember } from '@/lib/resolveActiveSessionMember';
import { supabase } from '@/lib/supabase';

export type SessionProfileAudience = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  family_id?: string | null;
};

const normalizeName = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const memberDedupKey = (member: Pick<FamilyMember, 'id' | 'full_name' | 'phone'>) => {
  const phone = normalizePhone(member.phone);

  if (phone.length >= 10) {
    return `phone:${phone}`;
  }

  const name = normalizeName(member.full_name);

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

  return Array.from(merged.values()).sort((left, right) =>
    left.full_name.localeCompare(right.full_name, 'pt-BR')
  );
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

  const sessionName = normalizeName(sessionProfile.full_name ?? sessionProfileName);

  if (sessionName && normalizeName(member.full_name) === sessionName) {
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
    sessionProfile.full_name?.trim() || sessionProfileName?.trim() || 'Participante';

  const { data: familyMembers, error: fetchError } = await supabase
    .from('members')
    .select('id, full_name, phone, birth_date, relationship, family_id, accepted')
    .ilike('family_id', normalizedFamilyId)
    .eq('accepted', MEMBER_ACCEPTED_VALUE);

  if (fetchError) {
    throw fetchError;
  }

  const members = (familyMembers as FamilyMember[] | null) ?? [];

  if (
    resolveActiveSessionMember(members, {
      sessionPhone: sessionProfile.phone,
      sessionProfileName: sessionProfile.full_name ?? sessionProfileName,
    })
    || members.some((member) => memberMatchesSessionProfile(member, sessionProfile, sessionProfileName))
  ) {
    return false;
  }

  const { error: insertError } = await supabase.from('members').insert([
    {
      full_name: displayName,
      phone: sessionProfile.phone?.trim() || null,
      birth_date: sessionProfile.birth_date ?? null,
      relationship: 'Outros',
      family_id: normalizedFamilyId,
      accepted: MEMBER_ACCEPTED_VALUE,
    },
  ]);

  if (insertError) {
    throw insertError;
  }

  return true;
}

