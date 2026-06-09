import {
  detachMemberFromFamilyWithNewCode,
  type MemberForFamilyReassign,
} from '@/lib/detachMemberFromFamily';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { upsertProfileForManagedMember } from '@/lib/memberProfiles';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';

export type { MemberForFamilyReassign };

/** Busca registro em `members` vinculado ao perfil (inclui accepted false/null). */
export async function findMemberForProfileUnfiltered(profile: {
  full_name?: string | null;
  phone?: string | null;
}): Promise<MemberForFamilyReassign | null> {
  const phone = profile.phone?.trim() || null;
  const fullName = profile.full_name?.trim() || null;
  const phoneVariants = phone ? buildPhoneDbQueryVariants(phone) : [];

  if (phoneVariants.length) {
    const { data } = await supabase
      .from('members')
      .select('id, full_name, phone, birth_date, family_id, accepted')
      .in('phone', phoneVariants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return data as MemberForFamilyReassign;
    }
  }

  if (fullName) {
    const { data } = await supabase
      .from('members')
      .select('id, full_name, phone, birth_date, family_id, accepted')
      .ilike('full_name', fullName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return data as MemberForFamilyReassign;
    }
  }

  return null;
}

async function hasOtherAcceptedMembersInFamily(familyId: string, excludeMemberId: string) {
  const { count, error } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .neq('id', excludeMemberId);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

/**
 * Gera novo código de família (`reserve_next_family_id` / legado `get_next_family_id`)
 * e aplica em `members` + perfil vinculado — mesmo fluxo do cadastro inicial.
 */
export async function applyNewFamilyCodeForRejectedMember(
  member: MemberForFamilyReassign,
  profileId?: string | null
) {
  return detachMemberFromFamilyWithNewCode(member, profileId);
}

/**
 * Em Dados Cadastrais: se o membro foi marcado como não pertencente (`accepted = false`)
 * e ainda compartilha código com família que o rejeitou, emite novo código.
 */
export async function reconcileRejectedMemberFamilyCode(profile: {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  family_id?: string | null;
  codigo_membro?: string | null;
}) {
  const member = await findMemberForProfileUnfiltered(profile);

  if (!member || member.accepted !== false) {
    return profile;
  }

  const profileFamily = (profile.family_id ?? profile.codigo_membro ?? '').trim();
  const memberFamily = (member.family_id ?? '').trim();

  const needsNewCode =
    Boolean(profileFamily) && (await hasOtherAcceptedMembersInFamily(profileFamily, member.id));

  if (needsNewCode) {
    const newFamilyId = await applyNewFamilyCodeForRejectedMember(member);
    return {
      ...profile,
      family_id: newFamilyId,
      codigo_membro: newFamilyId,
    };
  }

  if (memberFamily && memberFamily !== profileFamily) {
    await upsertProfileForManagedMember(
      {
        full_name: member.full_name,
        phone: member.phone,
        birth_date: member.birth_date ?? null,
      },
      memberFamily
    );

    return {
      ...profile,
      family_id: memberFamily,
      codigo_membro: memberFamily,
    };
  }

  return profile;
}
