import { upsertProfileForManagedMember, type MemberProfileInput } from '@/lib/memberProfiles';
import { syncManagedMemberProfileFamilyWithFallback } from '@/lib/syncManagedMemberProfileFamily';
import { supabase } from '@/lib/supabase';

const isMissingAcceptRpcError = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return false;
  }

  const message = String((error as { message: string }).message).toLowerCase();
  return message.includes('accept_managed_member_into_family');
};

async function acceptMemberIntoFamilyFallback(input: {
  memberId: string;
  targetFamilyId: string;
  profileId?: string | null;
  member: MemberProfileInput;
}) {
  const targetFamilyId = input.targetFamilyId.trim().toUpperCase();

  const { error: memberError } = await supabase
    .from('members')
    .update({
      accepted: true,
      family_id: targetFamilyId,
    })
    .eq('id', input.memberId);

  if (memberError) {
    throw memberError;
  }

  const syncResult = await syncManagedMemberProfileFamilyWithFallback({
    memberId: input.memberId,
    profileId: input.profileId,
    member: input.member,
    familyId: targetFamilyId,
  });

  if (!syncResult.success) {
    throw new Error(
      syncResult.message ?? 'Não foi possível sincronizar o código de família no perfil do membro.'
    );
  }

  return targetFamilyId;
}

/**
 * Aceita membro na família do gestor: substitui `family_id` em `members` e `profiles`.
 */
export async function acceptMemberIntoFamily(input: {
  memberId: string;
  targetFamilyId: string;
  profileId?: string | null;
  member: MemberProfileInput;
}): Promise<string> {
  const trimmedMemberId = input.memberId.trim();
  const targetFamilyId = input.targetFamilyId.trim().toUpperCase();

  if (!trimmedMemberId) {
    throw new Error('Membro sem identificador válido.');
  }

  if (!targetFamilyId) {
    throw new Error('Código da família de destino inválido.');
  }

  const { data, error } = await supabase.rpc('accept_managed_member_into_family', {
    p_member_id: trimmedMemberId,
    p_target_family_id: targetFamilyId,
    p_profile_id: input.profileId?.trim() || null,
  });

  if (!error) {
    const payload = (data ?? {}) as {
      success?: boolean;
      message?: string;
      family_id?: string;
    };

    if (payload.success === true && payload.family_id?.trim()) {
      return payload.family_id.trim();
    }

    if (payload.message) {
      throw new Error(payload.message);
    }
  }

  if (error && !isMissingAcceptRpcError(error)) {
    throw error;
  }

  return acceptMemberIntoFamilyFallback(input);
}
