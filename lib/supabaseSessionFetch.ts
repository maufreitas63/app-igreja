import { getGhostEffectiveProfileId } from '@/lib/ghostMode';
import { getSessionRequestIdentity } from '@/lib/sessionRequestIdentity';

const FETCH_TIMEOUT_MS = 20_000;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const parentSignal = init?.signal;

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};
