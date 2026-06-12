import AsyncStorage from '@react-native-async-storage/async-storage';

/** Mesmas chaves de `lib/userSession.ts` — evita import circular com supabase. */
const USER_PROFILE_ID_STORAGE_KEY = 'user_profile_id';
const USER_SESSION_TOKEN_STORAGE_KEY = 'user_session_token';

/** Envia token de sessão (fase 2) ou header legado ao PostgREST para RLS. */
export const supabaseSessionFetch: typeof fetch = async (input, init) => {
  const sessionToken = (await AsyncStorage.getItem(USER_SESSION_TOKEN_STORAGE_KEY))?.trim();
  const headers = new Headers(init?.headers);

  if (sessionToken) {
    headers.set('x-session-token', sessionToken);
  } else {
    const profileId = (await AsyncStorage.getItem(USER_PROFILE_ID_STORAGE_KEY))?.trim();
    if (profileId) {
      headers.set('x-profile-id', profileId);
    }
  }

  return fetch(input, { ...init, headers });
};
