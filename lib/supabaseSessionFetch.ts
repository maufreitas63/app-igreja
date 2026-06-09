import AsyncStorage from '@react-native-async-storage/async-storage';

/** Mesma chave de `lib/userSession.ts` — duplicada aqui para evitar import circular com supabase. */
const USER_PROFILE_ID_STORAGE_KEY = 'user_profile_id';

/** Envia `profiles.id` da sessão ao PostgREST para RLS (Passo 9f). */
export const supabaseSessionFetch: typeof fetch = async (input, init) => {
  const profileId = (await AsyncStorage.getItem(USER_PROFILE_ID_STORAGE_KEY))?.trim();
  const headers = new Headers(init?.headers);

  if (profileId) {
    headers.set('x-profile-id', profileId);
  }

  return fetch(input, { ...init, headers });
};
