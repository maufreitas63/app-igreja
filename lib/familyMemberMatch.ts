import { normalizeFamilyCode } from '@/lib/family';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { phoneDigitsMatch } from '@/lib/resolveProfileByPhone';
import { supabase } from '@/lib/supabase';

export type FamilyMemberMatchRow = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  family_id: string;
  accepted?: boolean | null;
};

const normalizeMemberName = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const memberNamesMatch = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const normalizedLeft = normalizeMemberName(left);
  const normalizedRight = normalizeMemberName(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const memberMatchesInput = (
  member: Pick<FamilyMemberMatchRow, 'full_name' | 'phone'>,
  input: { full_name: string; phone: string | null }
) => {
  if (input.phone?.trim() && phoneDigitsMatch(member.phone, input.phone)) {
    return true;
  }

  return memberNamesMatch(member.full_name, input.full_name);
};

/** Busca membros com telefone equivalente (variantes + fallback por sufixo). */
export async function findMembersMatchingPhone(
  phone: string | null | undefined
): Promise<FamilyMemberMatchRow[]> {
  const trimmedPhone = phone?.trim() || '';

  if (!trimmedPhone) {
    return [];
  }

  const phoneVariants = buildPhoneDbQueryVariants(trimmedPhone);
  const selectFields = 'id, full_name, phone, birth_date, family_id, accepted';

  if (phoneVariants.length) {
    const { data, error } = await supabase
      .from('members')
      .select(selectFields)
      .in('phone', phoneVariants);

    if (error) {
      throw error;
    }

    const variantMatches = ((data ?? []) as FamilyMemberMatchRow[]).filter((member) =>
      phoneDigitsMatch(member.phone, trimmedPhone)
    );

    if (variantMatches.length) {
      return variantMatches;
    }
  }

  const digits = trimmedPhone.replace(/\D/g, '');
  const localDigits = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;

  if (localDigits.length < 10) {
    return [];
  }

  const tail = localDigits.slice(-8);
  const { data: looseMatches, error: looseError } = await supabase
    .from('members')
    .select(selectFields)
    .ilike('phone', `%${tail}%`);

  if (looseError) {
    throw looseError;
  }

  return ((looseMatches ?? []) as FamilyMemberMatchRow[]).filter((member) =>
    phoneDigitsMatch(member.phone, trimmedPhone)
  );
}

/** Membro aceito já cadastrado na família com mesmo telefone ou nome. */
export async function findAcceptedMemberDuplicateInFamily(
  familyId: string,
  input: { full_name: string; phone: string | null },
  excludeMemberId?: string | null
): Promise<FamilyMemberMatchRow | null> {
  const targetFamilyId = normalizeFamilyCode(familyId);
  const trimmedName = input.full_name.trim();

  if (!targetFamilyId || !trimmedName) {
    return null;
  }

  const { data, error } = await supabase
    .from('members')
    .select('id, full_name, phone, birth_date, family_id, accepted')
    .ilike('family_id', targetFamilyId)
    .eq('accepted', MEMBER_ACCEPTED_VALUE);

  if (error) {
    throw error;
  }

  const duplicate = ((data ?? []) as FamilyMemberMatchRow[]).find((member) => {
    if (excludeMemberId && String(member.id) === String(excludeMemberId)) {
      return false;
    }

    return memberMatchesInput(member, {
      full_name: trimmedName,
      phone: input.phone,
    });
  });

  return duplicate ?? null;
}
