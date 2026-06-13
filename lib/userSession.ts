import { loadProfileByPhone } from '@/lib/profileOnboarding';
import { resetProfileScreenVisitTracking } from '@/lib/profileScreenVisitTracking';
import { isPwaInstalled } from '@/lib/pwaInstall';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';

import { Platform } from 'react-native';



export const USER_PHONE_STORAGE_KEY = 'user_phone';

export const USER_PROFILE_ID_STORAGE_KEY = 'user_profile_id';

/** Token emitido pelo Supabase no login/cadastro (`profile_sessions`). */
export const USER_SESSION_TOKEN_STORAGE_KEY = 'user_session_token';

/** Query na rota `/` para impedir restauração automática após logout. */

export const SIGN_OUT_QUERY_PARAM = 'signedOut';

/** Rota exibida no PWA instalado quando `window.close()` não é permitido (ex.: iOS). */

export const PWA_SIGNED_OUT_ROUTE = '/sessao-encerrada';



export const resolveProfileId = (profile: Record<string, unknown> | null | undefined) => {

  const raw = profile?.id;

  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;

};



export async function persistUserSession(
  profile: Record<string, unknown> | null | undefined,
  phoneForSession: string,
  sessionToken?: string | null
) {
  await AsyncStorage.setItem(USER_PHONE_STORAGE_KEY, phoneForSession);

  const profileId = resolveProfileId(profile);
  if (profileId) {
    await AsyncStorage.setItem(USER_PROFILE_ID_STORAGE_KEY, profileId);
  }

  const token = sessionToken?.trim();
  if (token) {
    await AsyncStorage.setItem(USER_SESSION_TOKEN_STORAGE_KEY, token);
  }
}

export async function persistSessionToken(sessionToken: string | null | undefined) {
  const token = sessionToken?.trim();
  if (token) {
    await AsyncStorage.setItem(USER_SESSION_TOKEN_STORAGE_KEY, token);
    return;
  }

  await AsyncStorage.removeItem(USER_SESSION_TOKEN_STORAGE_KEY);
}



export async function persistProfileId(profileId: string | null | undefined) {

  if (profileId?.trim()) {

    await AsyncStorage.setItem(USER_PROFILE_ID_STORAGE_KEY, profileId.trim());

  }

}



export async function getStoredUserPhone() {

  return AsyncStorage.getItem(USER_PHONE_STORAGE_KEY);

}



export async function getStoredProfileId() {

  return AsyncStorage.getItem(USER_PROFILE_ID_STORAGE_KEY);

}

export async function getStoredSessionToken() {
  return AsyncStorage.getItem(USER_SESSION_TOKEN_STORAGE_KEY);
}



export async function clearStoredProfileId() {

  await AsyncStorage.removeItem(USER_PROFILE_ID_STORAGE_KEY);

}



/**

 * Regrava telefone e `user_profile_id` a partir de `profiles` (útil se o ID local ficou inválido).

 */

/** Verifica se o `user_profile_id` gravado ainda existe em `profiles`. */
export async function storedProfileStillExists(): Promise<boolean> {
  const storedProfileId = await getStoredProfileId();

  if (!storedProfileId?.trim()) {
    return false;
  }

  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', storedProfileId.trim())
    .maybeSingle();

  if (error || !data?.id) {
    await clearStoredProfileId();
    return false;
  }

  return true;
}

export async function repairUserSessionReference(phone?: string | null): Promise<string | null> {

  const targetPhone = phone?.trim() || (await getStoredUserPhone());



  if (!targetPhone?.trim()) {

    return null;

  }



  await AsyncStorage.setItem(USER_PHONE_STORAGE_KEY, targetPhone.trim());



  const profile = await loadProfileByPhone(targetPhone);

  const profileId = resolveProfileId(profile);



  if (profileId) {

    await AsyncStorage.setItem(USER_PROFILE_ID_STORAGE_KEY, profileId);

    return profileId;

  }



  await clearStoredProfileId();

  return null;

}



const scrubWebSessionKeys = () => {

  if (Platform.OS !== 'web' || typeof window === 'undefined') {

    return;

  }



  const keysToDrop: string[] = [];



  for (let index = 0; index < window.localStorage.length; index += 1) {

    const key = window.localStorage.key(index);



    if (

      key &&

      (key === USER_PHONE_STORAGE_KEY ||

        key === USER_PROFILE_ID_STORAGE_KEY ||

        key === USER_SESSION_TOKEN_STORAGE_KEY ||

        key.includes(USER_PHONE_STORAGE_KEY) ||

        key.includes(USER_PROFILE_ID_STORAGE_KEY) ||

        key.includes(USER_SESSION_TOKEN_STORAGE_KEY))

    ) {

      keysToDrop.push(key);

    }

  }



  keysToDrop.forEach((key) => {

    window.localStorage.removeItem(key);

  });

};



/** Revoga o token no servidor (best-effort). */
export async function revokeStoredProfileSession() {
  const token = (await getStoredSessionToken())?.trim();

  if (!token) {
    return;
  }

  try {
    const { supabase } = await import('@/lib/supabase');
    await supabase.rpc('revoke_profile_session', { p_token: token });
  } catch (error) {
    console.warn('revoke_profile_session:', error);
  }
}

export async function clearUserSession() {
  await revokeStoredProfileSession();
  scrubWebSessionKeys();
  resetProfileScreenVisitTracking();
  await AsyncStorage.multiRemove([
    USER_PHONE_STORAGE_KEY,
    USER_PROFILE_ID_STORAGE_KEY,
    USER_SESSION_TOKEN_STORAGE_KEY,
  ]);
  scrubWebSessionKeys();
}

const LOGIN_AFTER_SIGN_OUT_ROUTE = {
  pathname: '/' as const,
  params: { [SIGN_OUT_QUERY_PARAM]: '1' },
};

/** Limpa chaves de sessão de forma síncrona (web) antes da navegação. */
const clearUserSessionImmediately = () => {
  scrubWebSessionKeys();
  resetProfileScreenVisitTracking();
  void revokeStoredProfileSession();
  void AsyncStorage.multiRemove([
    USER_PHONE_STORAGE_KEY,
    USER_PROFILE_ID_STORAGE_KEY,
    USER_SESSION_TOKEN_STORAGE_KEY,
  ]);
};

const buildWebLoginUrlAfterSignOut = () => {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.search = `${SIGN_OUT_QUERY_PARAM}=1`;
  url.hash = '';
  return url.toString();
};

const navigateToLoginAfterSignOut = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.replace(buildWebLoginUrlAfterSignOut());
    return;
  }

  try {
    router.dismissTo(LOGIN_AFTER_SIGN_OUT_ROUTE);
  } catch (error) {
    console.error('Erro ao navegar para login após logout:', error);

    try {
      router.dismissAll();
    } catch {
      // ignore — pode não haver stack para dispensar
    }

    router.replace(LOGIN_AFTER_SIGN_OUT_ROUTE);
  }
};

const buildPwaSignedOutUrl = () => {
  const url = new URL(window.location.href);
  url.pathname = PWA_SIGNED_OUT_ROUTE;
  url.search = '';
  url.hash = '';
  return url.toString();
};

/** Tenta fechar o PWA instalado; se o navegador bloquear, mostra tela neutra (sem login). */
const exitInstalledPwaAfterSignOut = () => {
  try {
    window.close();
  } catch {
    // Alguns navegadores bloqueiam close() — seguimos para o fallback abaixo.
  }

  window.setTimeout(() => {
    window.location.replace(buildPwaSignedOutUrl());
  }, 250);
};

/**
 * Encerra a sessão sem esperar I/O assíncrono.
 * No PWA instalado, tenta fechar o app; no navegador, volta à tela de login.
 */
export function signOutAndReturnToLogin(): void {
  clearUserSessionImmediately();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && isPwaInstalled()) {
    exitInstalledPwaAfterSignOut();
    return;
  }

  navigateToLoginAfterSignOut();
}


