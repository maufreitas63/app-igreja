import { getGhostEffectiveProfileId } from '@/lib/ghostMode';
import { getSessionRequestIdentity } from '@/lib/sessionRequestIdentity';

const FETCH_TIMEOUT_MS = 20_000;

export type SupabaseSessionFetchInit = RequestInit & {
  /** 0 desliga o timeout interno. Padrão: 20s. */
  timeoutMs?: number;
};

/** Envia token de sessão (fase 2), profile-id e tenant ativo. */
export async function supabaseSessionFetch(
  input: RequestInfo | URL,
  init?: SupabaseSessionFetchInit
): Promise<Response> {
  const identity = await getSessionRequestIdentity();
  const headers = new Headers(init?.headers);
  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const { timeoutMs: _timeoutMs, ...fetchInit } = init ?? {};

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
  const timeout =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const parentSignal = fetchInit.signal;

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...fetchInit, headers, signal: controller.signal });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
