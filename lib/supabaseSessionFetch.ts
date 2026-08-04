import { getGhostEffectiveProfileId } from '@/lib/ghostMode';
import { getSessionRequestIdentity } from '@/lib/sessionRequestIdentity';

/** Envia token de sessão (fase 2), profile-id e tenant ativo. */
export const supabaseSessionFetch: typeof fetch = async (input, init) => {
  const identity = await getSessionRequestIdentity();
  const headers = new Headers(init?.headers);

  if (identity.sessionToken) {
    headers.set('x-session-token', identity.sessionToken);
  }

  if (identity.profileId) {
    headers.set('x-profile-id', identity.profileId);
  }

  if (identity.tenantId) {
    headers.set('x-tenant-id', identity.tenantId);
  }

  const ghostProfileId = getGhostEffectiveProfileId();

  if (ghostProfileId) {
    headers.set('x-ghost-profile-id', ghostProfileId);
  }

  return fetch(input, { ...init, headers });
};
