import { reserveNextFamilyId } from '@/lib/family';
import { upsertProfileForManagedMember } from '@/lib/memberProfiles';
import { syncManagedMemberProfileFamilyWithFallback } from '@/lib/syncManagedMemberProfileFamily';
import { supabase } from '@/lib/supabase';

export type MemberForFamilyReassign = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date?: string | null;
  family_id?: string | null;
  accepted?: boolean | null;
};

const isMissingDetachRpcError = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return false;
  }

  const message = String((error as { message: string }).message).toLowerCase();
  return message.includes('detach_managed_member_from_family');
};

async function detachMemberFromFamilyFallback(
  member: MemberForFamilyReassign,
  profileId?: string | null
): Promise<string> {
  const newFamilyId = await reserveNextFamilyId();

  const { error: memberError } = await supabase
    .from('members')
    .update({
      family_id: newFamilyId,
      accepted: false,
    })
    .eq('id', member.id);

  if (memberError) {
    const message = String(memberError.message ?? '').toLowerCase();

    if (message.includes('policy') || message.includes('permission') || message.includes('row-level')) {
      throw new Error(
        'Sem permissão para atribuir novo código familiar. Execute scripts/sync-managed-member-profile-family-rpc.sql no Supabase.'
      );
    }

    throw memberError;
  }

  await syncManagedMemberProfileFamilyWithFallback({
    memberId: member.id,
    profileId,
    member: {
      full_name: member.full_name,
      phone: member.phone,
      birth_date: member.birth_date ?? null,
    },
    familyId: newFamilyId,
  });

  await upsertProfileForManagedMember(
    {
      full_name: member.full_name,
      phone: member.phone,
      birth_date: member.birth_date ?? null,
    },
    newFamilyId,
    null,
    undefined,
    profileId
  );

  return newFamilyId;
}

/**
 * Remove o membro da família atual e atribui novo código sequencial em `members` + `profiles`.
 */
export async function detachMemberFromFamilyWithNewCode(
  member: MemberForFamilyReassign,
  profileId?: string | null
): Promise<string> {
  const trimmedMemberId = member.id?.trim();

  if (!trimmedMemberId) {
    throw new Error('Membro sem identificador válido.');
  }

  const { data, error } = await supabase.rpc('detach_managed_member_from_family', {
    p_member_id: trimmedMemberId,
    p_profile_id: profileId?.trim() || null,
  });

  if (!error) {
    const payload = (data ?? {}) as {
      success?: boolean;
      message?: string;
      new_family_id?: string;
    };

    if (payload.success === true && payload.new_family_id?.trim()) {
      return payload.new_family_id.trim();
    }

    if (payload.message) {
      throw new Error(payload.message);
    }
  }

  if (error && !isMissingDetachRpcError(error)) {
    throw error;
  }

  return detachMemberFromFamilyFallback(member, profileId);
}
