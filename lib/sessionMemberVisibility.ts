import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';

let cachedMemberStatus: { profileId: string; isMember: boolean } | null = null;

export const invalidateSessionMemberVisibilityCache = () => {
  cachedMemberStatus = null;
};

/** Membro ativo no app (mesma regra da lista de membros do dashboard). */
export async function sessionIsActiveAppMember(options?: { forceRefresh?: boolean }) {
  const profileId = await resolveActorProfileId({ forceRefresh: options?.forceRefresh });

  if (!profileId) {
    return false;
  }

  if (!options?.forceRefresh && cachedMemberStatus?.profileId === profileId) {
    return cachedMemberStatus.isMember;
  }

  const { data, error } = await supabase.rpc('profile_is_members_list_member', {
    p_profile_id: profileId,
  });

  const isMember = !error && data === true;
  cachedMemberStatus = { profileId, isMember };

  return isMember;
}
