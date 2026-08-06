import {
  getStoredProfileId,
  getStoredSessionToken,
  refreshProfileSessionToken,
} from '@/lib/userSession';
import { getSessionRequestIdentity, patchSessionRequestIdentity } from '@/lib/sessionRequestIdentity';

/**
 * Garante que headers nativos de sessão estão utilizáveis após login / cold start.
 * ACL no Supabase é fail-closed: sem token/profile válidos as telas “somem”.
 */
export async function ensureSessionReady(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const fromDiskProfile = (await getStoredProfileId())?.trim() || null;
  const fromDiskToken = (await getStoredSessionToken())?.trim() || null;
  const identity = await getSessionRequestIdentity();

  const profileId = identity.profileId || fromDiskProfile;
  if (!profileId) {
    return { ok: false, reason: 'missing_profile' };
  }

  if (identity.profileId !== profileId || identity.sessionToken !== fromDiskToken) {
    patchSessionRequestIdentity({
      profileId,
      sessionToken: identity.sessionToken || fromDiskToken,
    });
  }

  let sessionToken =
    (await getSessionRequestIdentity()).sessionToken || fromDiskToken;

  if (!sessionToken) {
    sessionToken = await refreshProfileSessionToken(profileId);
  }

  if (!sessionToken) {
    return { ok: false, reason: 'token_issue_failed' };
  }

  patchSessionRequestIdentity({ profileId, sessionToken });
  return { ok: true };
}
