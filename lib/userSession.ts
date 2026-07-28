import { loadProfileByPhone } from '@/lib/profileOnboarding';
import { clearGhostModeState } from '@/lib/ghostMode';
import { resetProfileScreenVisitTracking } from '@/lib/profileScreenVisitTracking';
import { isAndroidWeb } from '@/lib/pwaInstall';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';

import { BackHandler, Platform } from 'react-native';



export const USER_PHONE_STORAGE_KEY = 'user_phone';

export const USER_PROFILE_ID_STORAGE_KEY = 'user_profile_id';

/** Token emitido pelo Supabase no login/cadastro (`profile_sessions`). */
export const USER_SESSION_TOKEN_STORAGE_KEY = 'user_session_token';

/** Reexport — igreja ativa da sessão (também em `lib/tenantSession.ts`). */
export { USER_TENANT_ID_STORAGE_KEY } from '@/lib/tenantSession';

/** Query na rota `/` para impedir restauração automática após logout. */

export const SIGN_OUT_QUERY_PARAM = 'signedOut';

/** Rota exibida no PWA instalado quando `window.close()` não é permitido (ex.: iOS). */

export const PWA_SIGNED_OUT_ROUTE = '/sessao-encerrada';



export const resolveProfileId = (profile: Record<string, unknown> | null | undefined) => {

  const raw = profile?.id;

  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;

};



async function issueProfileSessionToken(profileId: string): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.rpc('issue_profile_session', {
      p_profile_id: profileId,
    });

    if (error) {
      console.warn('issue_profile_session:', error);
      return null;
    }

    return typeof data === 'string' && data.trim() ? data.trim() : null;
  } catch (error) {
    console.warn('issue_profile_session:', error);
    return null;
  }
}

/** Renova token de sessão no servidor (útil quando x-session-token expirou mas o perfil ainda está no app). */
export async function refreshProfileSessionToken(profileId: string): Promise<string | null> {
  const normalizedProfileId = profileId?.trim();
  if (!normalizedProfileId) {
    return null;
  }

  await persistSessionToken(null);

  const token = await issueProfileSessionToken(normalizedProfileId);
  if (token) {
    await persistSessionToken(token);
  }

  return token;
}

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

  let token = sessionToken?.trim() || null;

  if (!token && profileId) {
    token = await issueProfileSessionToken(profileId);
  }

  if (token) {
    await AsyncStorage.setItem(USER_SESSION_TOKEN_STORAGE_KEY, token);
  }

  // Evita ACL/perfil cacheados de tentativas anteriores (fail-closed falso após PIN).
  try {
    const { invalidateSessionProfileCache } = await import('@/lib/sessionProfile');
    const { invalidateAccessControlCache } = await import('@/lib/accessControl');
    invalidateSessionProfileCache();
    invalidateAccessControlCache({ profileId, allProfiles: !profileId });
  } catch {
    // best-effort
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

/** Grava o celular para autofill no próximo login (não é apagado ao sair). */
export async function persistUserPhone(phone: string | null | undefined) {
  const trimmed = phone?.trim();

  if (!trimmed) {
    return;
  }

  await AsyncStorage.setItem(USER_PHONE_STORAGE_KEY, trimmed);
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



/** Remove chaves de sessão na web, preservando o celular para autofill no próximo login. */
const scrubWebSessionKeys = (options?: { keepPhone?: boolean }) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  const keepPhone = options?.keepPhone !== false;
  const keysToDrop: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key) {
      continue;
    }

    const isPhoneKey =
      key === USER_PHONE_STORAGE_KEY || key.includes(USER_PHONE_STORAGE_KEY);

    if (keepPhone && isPhoneKey) {
      continue;
    }

    if (
      isPhoneKey
      || key === USER_PROFILE_ID_STORAGE_KEY
      || key === USER_SESSION_TOKEN_STORAGE_KEY
      || key === 'user_tenant_id'
      || key === 'user_tenant_branding'
      || key === 'preferred_igreja_code'
      || key.includes(USER_PROFILE_ID_STORAGE_KEY)
      || key.includes(USER_SESSION_TOKEN_STORAGE_KEY)
      || key.includes('user_tenant_id')
      || key.includes('user_tenant_branding')
      || key.includes('preferred_igreja_code')
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

export async function clearUserSession(options?: { keepPhone?: boolean }) {
  const keepPhone = options?.keepPhone !== false;
  clearGhostModeState();
  await revokeStoredProfileSession();
  scrubWebSessionKeys({ keepPhone });
  resetProfileScreenVisitTracking();
  const {
    USER_TENANT_ID_STORAGE_KEY: tenantKey,
    USER_TENANT_BRANDING_STORAGE_KEY: brandingKey,
    PREFERRED_IGREJA_CODE_STORAGE_KEY: preferredKey,
  } = await import('@/lib/tenantSession');
  await AsyncStorage.multiRemove(
    keepPhone
      ? [
          USER_PROFILE_ID_STORAGE_KEY,
          USER_SESSION_TOKEN_STORAGE_KEY,
          tenantKey,
          brandingKey,
          preferredKey,
        ]
      : [
          USER_PHONE_STORAGE_KEY,
          USER_PROFILE_ID_STORAGE_KEY,
          USER_SESSION_TOKEN_STORAGE_KEY,
          tenantKey,
          brandingKey,
          preferredKey,
        ]
  );
  scrubWebSessionKeys({ keepPhone });
}

const LOGIN_AFTER_SIGN_OUT_ROUTE = {
  pathname: '/' as const,
  params: { [SIGN_OUT_QUERY_PARAM]: '1' },
};

/** Limpa sessão de forma síncrona antes da navegação, preservando o celular para autofill. */
const clearUserSessionImmediately = () => {
  clearGhostModeState();
  scrubWebSessionKeys({ keepPhone: true });
  resetProfileScreenVisitTracking();
  void revokeStoredProfileSession();
  void import('@/lib/tenantSession').then(
    ({
      USER_TENANT_ID_STORAGE_KEY: tenantKey,
      USER_TENANT_BRANDING_STORAGE_KEY: brandingKey,
      PREFERRED_IGREJA_CODE_STORAGE_KEY: preferredKey,
    }) =>
      AsyncStorage.multiRemove([
        USER_PROFILE_ID_STORAGE_KEY,
        USER_SESSION_TOKEN_STORAGE_KEY,
        tenantKey,
        brandingKey,
        preferredKey,
      ])
  );
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

/** Tela neutra quando o SO não permite fechar o app (nunca volta ao login). */
const navigateToPwaSignedOutScreen = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.replace(buildPwaSignedOutUrl());
    return;
  }

  try {
    router.dismissAll();
  } catch {
    // ignore
  }

  router.replace(PWA_SIGNED_OUT_ROUTE);
};

/** Intent Android: envia o usuário à tela inicial do sistema (equivalente a “sair” do PWA). */
const ANDROID_HOME_INTENT =
  'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.HOME;end';

const isWebWindowStillOpen = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    return !window.closed && document.visibilityState === 'visible';
  } catch {
    return false;
  }
};

const tryCloseWebWindow = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const maybeApp = (window.navigator as Navigator & { app?: { exitApp?: () => void } }).app;
    maybeApp?.exitApp?.();
  } catch {
    // ignore
  }

  try {
    window.open('', '_self');
    window.close();
  } catch {
    // Alguns navegadores bloqueiam close().
  }
};

const trySendAndroidPwaToHome = () => {
  if (!isAndroidWeb() || typeof window === 'undefined') {
    return false;
  }

  try {
    window.location.replace(ANDROID_HOME_INTENT);
    return true;
  } catch {
    return false;
  }
};

/** Se o fechamento falhar, exibe tela neutra (sessão já foi limpa; nunca volta ao login). */
const scheduleWebExitFallback = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.setTimeout(() => {
    if (!isWebWindowStillOpen()) {
      return;
    }

    navigateToPwaSignedOutScreen();
  }, 650);
};

/** Tenta fechar o PWA instalado; se o SO bloquear, cai na tela neutra pós-saída. */
const exitWebApplication = () => {
  tryCloseWebWindow();

  if (isAndroidWeb()) {
    trySendAndroidPwaToHome();
  }

  // Aguarda o SO processar close()/HOME antes de cair na tela neutra.
  scheduleWebExitFallback();
};

/**
 * Encerra a sessão e volta à tela de login (navegador ou erro de sessão).
 * Não tenta fechar o processo/janela do aplicativo.
 */
export function signOutAndNavigateToLogin(): void {
  clearUserSessionImmediately();
  navigateToLoginAfterSignOut();
}

/**
 * Encerra a sessão e tenta fechar o aplicativo de forma definitiva.
 * Na web, tenta `window.close()` e intent HOME (Android); se o SO bloquear, vai para `/sessao-encerrada`.
 * Nunca redireciona à tela de login.
 */
export function exitApplication(): void {
  clearUserSessionImmediately();

  if (Platform.OS === 'android') {
    BackHandler.exitApp();
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    exitWebApplication();
    return;
  }

  navigateToPwaSignedOutScreen();
}

/**
 * Encerra a sessão sem esperar I/O assíncrono.
 * Preferir `exitApplication()` (botão Sair) ou `signOutAndNavigateToLogin()` (sessão inválida).
 */
export function signOutAndReturnToLogin(): void {
  signOutAndNavigateToLogin();
}

const resolveConfirmedExitAction = async () => {
  const { shouldExitApplicationProcess } = await import('@/lib/sessionExitUi');
  return shouldExitApplicationProcess() ? exitApplication : signOutAndNavigateToLogin;
};

/** Confirma saída do app (botão nativo voltar na tela inicial). */
export async function confirmExitApplication(): Promise<boolean> {
  const { confirmDialog } = await import('@/lib/confirmDialog');
  const exitUi = (await import('@/lib/sessionExitUi')).getExitSessionUi();
  const onConfirmed = await resolveConfirmedExitAction();

  const confirmed = await confirmDialog(
    exitUi.button,
    exitUi.confirmMessage,
    'Sair',
    'Cancelar',
    { onConfirmed }
  );

  return confirmed;
}

