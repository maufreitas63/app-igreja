import {
  isConjugeRelationship,
  isRepresentanteLegalRelationship,
} from '@/lib/familyRelationshipOptions';
import { formatFullName } from '@/lib/fullName';
import { joinBirthdayNames } from '@/lib/birthdayGreetingAccess';
import { isBirthdayToday, parseBirthdayParts } from '@/lib/birthdaysClassUtils';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { normalizeFamilyCode } from '@/lib/family';
import { supabase } from '@/lib/supabase';
import { getStoredTenantId } from '@/lib/tenantSession';

export type WeddingAnniversaryCouple = {
  family_id: string;
  full_name: string;
  names: string[];
  marriage_date: string;
  day: number;
  month: number;
};

type MemberWeddingRow = {
  family_id: string | null;
  full_name: string | null;
  relationship: string | null;
  marriage_date: string | null;
  accepted: boolean | null;
};

const pickCoupleNames = (members: MemberWeddingRow[]) => {
  const legal = members.find((member) => isRepresentanteLegalRelationship(member.relationship));
  const spouse = members.find((member) => isConjugeRelationship(member.relationship));
  const names = [legal, spouse]
    .map((member) => formatFullName(member?.full_name))
    .filter(Boolean);

  if (names.length > 0) {
    return names;
  }

  return members
    .map((member) => formatFullName(member.full_name))
    .filter(Boolean)
    .slice(0, 2);
};

/** Casais com aniversário de casamento hoje (members.marriage_date + vínculo RL/cônjuge). */
export async function loadWeddingAnniversariesToday(): Promise<WeddingAnniversaryCouple[]> {
  const activeTenantId = (await getStoredTenantId())?.trim() || '';

  let datedQuery = supabase
    .from('members')
    .select('family_id, full_name, relationship, marriage_date, accepted')
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .not('marriage_date', 'is', null)
    .not('family_id', 'is', null);

  if (activeTenantId) {
    datedQuery = datedQuery.eq('tenant_id', activeTenantId);
  }

  const { data: datedRows, error: datedError } = await datedQuery;

  if (datedError) {
    throw datedError;
  }

  const todayRows = ((datedRows ?? []) as MemberWeddingRow[]).filter((member) => {
    const parts = parseBirthdayParts(member.marriage_date);
    return parts ? isBirthdayToday(parts) : false;
  });

  const todayFamilyIds = [
    ...new Set(
      todayRows
        .map((member) => String(member.family_id ?? '').trim())
        .filter(Boolean)
    ),
  ];

  if (todayFamilyIds.length === 0) {
    return [];
  }

  let familyQuery = supabase
    .from('members')
    .select('family_id, full_name, relationship, marriage_date, accepted')
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .in('family_id', todayFamilyIds);

  if (activeTenantId) {
    familyQuery = familyQuery.eq('tenant_id', activeTenantId);
  }

  const { data, error } = await familyQuery;

  if (error) {
    throw error;
  }

  const members = (data ?? []) as MemberWeddingRow[];
  const byFamily = new Map<string, MemberWeddingRow[]>();

  for (const member of members) {
    const familyId = normalizeFamilyCode(member.family_id);
    if (!familyId) {
      continue;
    }

    const current = byFamily.get(familyId) ?? [];
    current.push(member);
    byFamily.set(familyId, current);
  }

  const couples: WeddingAnniversaryCouple[] = [];

  for (const [familyId, familyMembers] of byFamily) {
    const datedMembers = familyMembers.filter((member) => {
      const parts = parseBirthdayParts(member.marriage_date);
      return parts ? isBirthdayToday(parts) : false;
    });

    if (datedMembers.length === 0) {
      continue;
    }

    const names = pickCoupleNames(familyMembers);
    if (names.length === 0) {
      continue;
    }

    const source = datedMembers[0];
    const parts = parseBirthdayParts(source.marriage_date);
    if (!parts) {
      continue;
    }

    couples.push({
      family_id: familyId,
      full_name: joinBirthdayNames(names),
      names,
      marriage_date: String(source.marriage_date),
      day: parts.day,
      month: parts.month,
    });
  }

  return couples.sort((left, right) => left.full_name.localeCompare(right.full_name, 'pt-BR'));
}
