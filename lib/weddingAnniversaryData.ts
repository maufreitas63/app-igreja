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
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { getStoredTenantId } from '@/lib/tenantSession';

export type WeddingAnniversaryCouple = {
  family_id: string;
  full_name: string;
  names: string[];
  phone: string | null;
  marriage_date: string;
  day: number;
  month: number;
};

type MemberWeddingRow = {
  family_id: string | null;
  full_name: string | null;
  phone: string | null;
  relationship: string | null;
  marriage_date: string | null;
  accepted: boolean | null;
};

type WeddingAnniversaryRpcRow = {
  family_id?: string | null;
  full_name?: string | null;
  names?: string[] | null;
  phone?: string | null;
  marriage_date?: string | null;
  day?: number | null;
  month?: number | null;
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

const pickCouplePhone = (members: MemberWeddingRow[]) => {
  const legal = members.find((member) => isRepresentanteLegalRelationship(member.relationship));
  const spouse = members.find((member) => isConjugeRelationship(member.relationship));
  return legal?.phone?.trim() || spouse?.phone?.trim() || members.find((member) => member.phone)?.phone || null;
};

const mapRpcRow = (row: WeddingAnniversaryRpcRow): WeddingAnniversaryCouple | null => {
  const familyId = normalizeFamilyCode(row.family_id);
  const names = (row.names ?? []).map((name) => formatFullName(name)).filter(Boolean);
  const fullName = formatFullName(row.full_name) || joinBirthdayNames(names);
  const marriageDate = row.marriage_date ? String(row.marriage_date) : '';
  const parts = parseBirthdayParts(marriageDate);
  const day = Number(row.day);
  const month = Number(row.month);

  if (!familyId || !fullName || !parts) {
    return null;
  }

  return {
    family_id: familyId,
    full_name: fullName,
    names: names.length ? names : [fullName],
    phone: row.phone?.trim() || null,
    marriage_date: marriageDate,
    day: Number.isFinite(day) ? day : parts.day,
    month: Number.isFinite(month) ? month : parts.month,
  };
};

async function loadWeddingAnniversariesFallback(): Promise<WeddingAnniversaryCouple[]> {
  const activeTenantId = (await getStoredTenantId())?.trim() || '';

  let datedQuery = supabase
    .from('members')
    .select('family_id, full_name, phone, relationship, marriage_date, accepted')
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

  const familyIds = [
    ...new Set(
      ((datedRows ?? []) as MemberWeddingRow[])
        .map((member) => String(member.family_id ?? '').trim())
        .filter(Boolean)
    ),
  ];

  if (familyIds.length === 0) {
    return [];
  }

  let familyQuery = supabase
    .from('members')
    .select('family_id, full_name, phone, relationship, marriage_date, accepted')
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .in('family_id', familyIds);

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
    const datedMembers = familyMembers.filter((member) => parseBirthdayParts(member.marriage_date));
    if (datedMembers.length === 0) {
      continue;
    }

    const names = pickCoupleNames(familyMembers);
    if (names.length === 0) {
      continue;
    }

    const source =
      datedMembers.find((member) => isRepresentanteLegalRelationship(member.relationship))
      ?? datedMembers.find((member) => isConjugeRelationship(member.relationship))
      ?? datedMembers[0];
    const parts = parseBirthdayParts(source.marriage_date);
    if (!parts) {
      continue;
    }

    couples.push({
      family_id: familyId,
      full_name: joinBirthdayNames(names),
      names,
      phone: pickCouplePhone(familyMembers),
      marriage_date: String(source.marriage_date),
      day: parts.day,
      month: parts.month,
    });
  }

  return couples.sort(
    (left, right) =>
      left.month - right.month ||
      left.day - right.day ||
      left.full_name.localeCompare(right.full_name, 'pt-BR')
  );
}

/** Casais com data de casamento em members (RL + cônjuge da mesma família). */
export async function loadWeddingAnniversaryCouples(): Promise<WeddingAnniversaryCouple[]> {
  const { data, error } = await supabase.rpc('list_wedding_anniversaries');

  if (!error) {
    return ((data ?? []) as WeddingAnniversaryRpcRow[])
      .map(mapRpcRow)
      .filter((row): row is WeddingAnniversaryCouple => row !== null)
      .sort(
        (left, right) =>
          left.month - right.month ||
          left.day - right.day ||
          left.full_name.localeCompare(right.full_name, 'pt-BR')
      );
  }

  if (!isSupabaseRpcMissingError(error, 'list_wedding_anniversaries')) {
    throw error;
  }

  return loadWeddingAnniversariesFallback();
}

export async function loadWeddingAnniversariesToday(): Promise<WeddingAnniversaryCouple[]> {
  const couples = await loadWeddingAnniversaryCouples();
  return couples.filter((couple) => isBirthdayToday(couple));
}
