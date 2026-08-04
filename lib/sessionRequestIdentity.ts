import AsyncStorage from '@react-native-async-storage/async-storage';

/** Mesmas chaves de `lib/userSession.ts` / `lib/tenantSession.ts` — cache síncrono para headers nativos. */
const USER_PROFILE_ID_STORAGE_KEY = 'user_profile_id';
const USER_SESSION_TOKEN_STORAGE_KEY = 'user_session_token';
const USER_TENANT_ID_STORAGE_KEY = 'user_tenant_id';

export type SessionRequestIdentity = {
  sessionToken: string | null;
  profileId: string | null;
  tenantId: string | null;
};

let cache: SessionRequestIdentity = {
  sessionToken: null,
  profileId: null,
  tenantId: null,
};

let hydratedFromDisk = false;
let hydratePromise: Promise<void> | null = null;

const normalize = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Atualiza o cache em memória usado por `supabaseSessionFetch`.
 * Deve ser chamado junto de cada gravação em AsyncStorage (login, tenant, logout).
 */
export function patchSessionRequestIdentity(
  partial: Partial<SessionRequestIdentity>
) {
  if ('sessionToken' in partial) {
    cache.sessionToken = normalize(partial.sessionToken);
  }
  if ('profileId' in partial) {
    cache.profileId = normalize(partial.profileId);
  }
  if ('tenantId' in partial) {
    cache.tenantId = normalize(partial.tenantId);
  }
  hydratedFromDisk = true;
}

export function clearSessionRequestIdentityMemory() {
  cache = {
    sessionToken: null,
    profileId: null,
    tenantId: null,
  };
  hydratedFromDisk = true;
}

async function hydrateFromDisk() {
  if (hydratedFromDisk) {
    return;
  }

  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          USER_SESSION_TOKEN_STORAGE_KEY,
          USER_PROFILE_ID_STORAGE_KEY,
          USER_TENANT_ID_STORAGE_KEY,
        ]);
        const map = Object.fromEntries(pairs);
        cache = {
          sessionToken: normalize(map[USER_SESSION_TOKEN_STORAGE_KEY]),
          profileId: normalize(map[USER_PROFILE_ID_STORAGE_KEY]),
          tenantId: normalize(map[USER_TENANT_ID_STORAGE_KEY]),
        };
      } catch (error) {
        console.warn('sessionRequestIdentity hydrate:', error);
      } finally {
        hydratedFromDisk = true;
        hydratePromise = null;
      }
    })();
  }

  await hydratePromise;
}

/** Identidade de sessão para headers HTTP (token / profile / tenant). */
export async function getSessionRequestIdentity(): Promise<SessionRequestIdentity> {
  await hydrateFromDisk();
  return { ...cache };
}
