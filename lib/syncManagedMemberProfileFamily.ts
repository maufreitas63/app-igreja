import { upsertProfileForManagedMember, type MemberProfileInput } from '@/lib/memberProfiles';
import { supabase } from '@/lib/supabase';

type SyncManagedMemberProfileFamilyResult = {
  success: boolean;
  message?: string;
  profileId?: string;
  familyId?: string;
};

const isMissingSyncRpcError = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return false;
  }

  const message = String((error as { message: string }).message).toLowerCase();
  return message.includes('sync_managed_member_profile_family');
};

export async function syncManagedMemberProfileFamily(
  memberId: string,
  profileId?: string | null
): Promise<SyncManagedMemberProfileFamilyResult> {
  const trimmedMemberId = memberId.trim();

  if (!trimmedMemberId) {
    return { success: false, message: 'Identificador do membro inválido.' };
  }

  const { data, error } = await supabase.rpc('sync_managed_member_profile_family', {
    p_member_id: trimmedMemberId,
    p_profile_id: profileId?.trim() || null,
  });

  if (error) {
    if (isMissingSyncRpcError(error)) {
      return { success: false, message: 'RPC sync_managed_member_profile_family não instalada no Supabase.' };
    }

    throw error;
  }

  const payload = (data ?? {}) as {
    success?: boolean;
    message?: string;
    profile_id?: string;
    family_id?: string;
  };

  return {
    success: payload.success === true,
    message: payload.message,
    profileId: payload.profile_id,
    familyId: payload.family_id,
  };
}

/** Sincroniza família no perfil após gravar em `members` (RPC + fallback legado). */
export async function syncManagedMemberProfileFamilyWithFallback(input: {
  memberId: string;
  profileId?: string | null;
  member: MemberProfileInput;
  familyId: string;
}) {
  const rpcResult = await syncManagedMemberProfileFamily(input.memberId, input.profileId);

  if (rpcResult.success) {
    return rpcResult;
  }

  const profileId = await upsertProfileForManagedMember(
    input.member,
    input.familyId,
    null,
    null,
    input.profileId
  );

  if (!profileId) {
    return {
      success: false,
      message:
        rpcResult.message ??
        'Não foi possível sincronizar o código de família no perfil do membro.',
    };
  }

  return {
    success: true,
    profileId,
    familyId: input.familyId,
  };
}
