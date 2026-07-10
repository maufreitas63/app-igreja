import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGhostEffectiveProfileId } from '@/lib/ghostMode';

/** Mesmas chaves de `lib/userSession.ts` / `lib/tenantSession.ts` — evita import circular com supabase. */
const USER_PROFILE_ID_STORAGE_KEY = 'user_profile_id';
const USER_SESSION_TOKEN_STORAGE_KEY = 'user_session_token';
const USER_TENANT_ID_STORAGE_KEY = 'user_tenant_id';

/** Envia token de sessão (fase 2), profile-id e tenant ativo. */
export const supabaseSessionFetch: typeof fetch = async (input, init) => {
  const sessionToken = (await AsyncStorage.getItem(USER_SESSION_TOKEN_STORAGE_KEY))?.trim();
  const profileId = (await AsyncStorage.getItem(USER_PROFILE_ID_STORAGE_KEY))?.trim();
  const tenantId = (await AsyncStorage.getItem(USER_TENANT_ID_STORAGE_KEY))?.trim();
  const headers = new Headers(init?.headers);

  if (sessionToken) {
    headers.set('x-session-token', sessionToken);
  }

  if (profileId) {
    headers.set('x-profile-id', profileId);
  }

  if (tenantId) {
    headers.set('x-tenant-id', tenantId);
  }

  const ghostProfileId = getGhostEffectiveProfileId();

  if (ghostProfileId) {
    headers.set('x-ghost-profile-id', ghostProfileId);
  }

  return fetch(input, { ...init, headers });
};
