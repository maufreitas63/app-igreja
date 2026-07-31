import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';

import { ACCESS_PIN_LENGTH, isValidAccessPin } from '@/lib/accessPin';

/** Preferência local: biometria ativa neste aparelho (não é segredo). */
export const BIOMETRIC_UNLOCK_ENABLED_KEY = 'biometric_unlock_enabled';

/** Telefone (apenas dígitos) vinculado à credencial biométrica. */
const BIOMETRIC_PHONE_SECURE_KEY = 'biometric_unlock_phone';

/** PIN de 4 dígitos protegido pelo Keychain / Keystore. */
const BIOMETRIC_PIN_SECURE_KEY = 'biometric_unlock_pin';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type BiometricAvailability = {
  supported: boolean;
  hardware: boolean;
  enrolled: boolean;
  label: string;
};

export type BiometricUnlockCredential = {
  phoneDigits: string;
  pin: string;
};

let processUnlocked = false;

const normalizePhoneDigits = (phone: string | null | undefined) =>
  (phone ?? '').replace(/\D/g, '');

/** Web/PWA não tem biometria nativa neste app. */
export function isBiometricPlatformSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function markBiometricProcessUnlocked() {
  processUnlocked = true;
}

export function clearBiometricProcessUnlock() {
  processUnlocked = false;
}

export function isBiometricProcessUnlocked() {
  return processUnlocked;
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (!isBiometricPlatformSupported()) {
    return {
      supported: false,
      hardware: false,
      enrolled: false,
      label: 'Biometria',
    };
  }

  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    return {
      supported: hardware && enrolled,
      hardware,
      enrolled,
      label: resolveBiometricLabel(types),
    };
  } catch (error) {
    console.warn('getBiometricAvailability:', error);
    return {
      supported: false,
      hardware: false,
      enrolled: false,
      label: 'Biometria',
    };
  }
}

function resolveBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

  if (Platform.OS === 'ios') {
    if (hasFace) {
      return 'Face ID';
    }
    if (hasFingerprint) {
      return 'Touch ID';
    }
    return 'Biometria';
  }

  if (hasFingerprint && hasFace) {
    return 'Biometria';
  }
  if (hasFingerprint) {
    return 'Impressão digital';
  }
  if (hasFace) {
    return 'Reconhecimento facial';
  }
  return 'Biometria';
}

export async function getBiometricLabel() {
  const availability = await getBiometricAvailability();
  return availability.label;
}

async function readSecureItem(key: string) {
  if (!isBiometricPlatformSupported()) {
    return null;
  }

  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) {
      return null;
    }

    return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
  } catch (error) {
    console.warn(`SecureStore.getItemAsync(${key}):`, error);
    return null;
  }
}

async function writeSecureItem(key: string, value: string) {
  if (!isBiometricPlatformSupported()) {
    return false;
  }

  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) {
      return false;
    }

    await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
    return true;
  } catch (error) {
    console.warn(`SecureStore.setItemAsync(${key}):`, error);
    return false;
  }
}

async function deleteSecureItem(key: string) {
  if (!isBiometricPlatformSupported()) {
    return;
  }

  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) {
      return;
    }

    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  } catch (error) {
    console.warn(`SecureStore.deleteItemAsync(${key}):`, error);
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  if (!isBiometricPlatformSupported()) {
    return false;
  }

  try {
    const flag = await AsyncStorage.getItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
    if (flag !== '1') {
      return false;
    }

    const phone = await readSecureItem(BIOMETRIC_PHONE_SECURE_KEY);
    const pin = await readSecureItem(BIOMETRIC_PIN_SECURE_KEY);
    return Boolean(phone && pin && isValidAccessPin(pin));
  } catch (error) {
    console.warn('isBiometricUnlockEnabled:', error);
    return false;
  }
}

export async function isBiometricUnlockEnabledForPhone(
  phone: string | null | undefined
): Promise<boolean> {
  const phoneDigits = normalizePhoneDigits(phone);
  if (!phoneDigits) {
    return false;
  }

  const enabled = await isBiometricUnlockEnabled();
  if (!enabled) {
    return false;
  }

  const storedPhone = await readSecureItem(BIOMETRIC_PHONE_SECURE_KEY);
  return normalizePhoneDigits(storedPhone) === phoneDigits;
}

export async function getBiometricUnlockPhoneDigits(): Promise<string | null> {
  if (!(await isBiometricUnlockEnabled())) {
    return null;
  }

  const phone = await readSecureItem(BIOMETRIC_PHONE_SECURE_KEY);
  const digits = normalizePhoneDigits(phone);
  return digits || null;
}

export async function clearBiometricUnlockCredentials() {
  clearBiometricProcessUnlock();
  await AsyncStorage.removeItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
  await deleteSecureItem(BIOMETRIC_PHONE_SECURE_KEY);
  await deleteSecureItem(BIOMETRIC_PIN_SECURE_KEY);
}

/**
 * Autentica com biometria nativa.
 * Em falha/indisponibilidade o chamador deve oferecer PIN ou login tradicional.
 */
export async function authenticateWithBiometrics(options?: {
  promptMessage?: string;
  cancelLabel?: string;
  fallbackLabel?: string;
}): Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }> {
  const availability = await getBiometricAvailability();

  if (!availability.supported) {
    return {
      ok: false,
      error: availability.hardware
        ? 'Nenhuma biometria cadastrada neste aparelho. Use a senha de 4 dígitos.'
        : 'Biometria não disponível neste aparelho. Use a senha de 4 dígitos.',
    };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: options?.promptMessage ?? `Entrar com ${availability.label}`,
      cancelLabel: options?.cancelLabel ?? 'Cancelar',
      fallbackLabel: options?.fallbackLabel ?? 'Usar senha',
      // Evita cair no passcode do aparelho; o app oferece PIN próprio como fallback.
      disableDeviceFallback: true,
    });

    if (result.success) {
      return { ok: true };
    }

    const error = result.error ?? 'authentication_failed';
    const cancelled =
      error === 'user_cancel'
      || error === 'app_cancel'
      || error === 'system_cancel'
      || error === 'user_fallback';

    return {
      ok: false,
      cancelled,
      error: cancelled
        ? 'Autenticação cancelada.'
        : error === 'lockout'
          ? 'Biometria bloqueada temporariamente. Use a senha de 4 dígitos.'
          : 'Não foi possível autenticar. Use a senha de 4 dígitos.',
    };
  } catch (error) {
    console.warn('authenticateWithBiometrics:', error);
    return {
      ok: false,
      error: 'Biometria indisponível no momento. Use a senha de 4 dígitos.',
    };
  }
}

export async function enableBiometricUnlock(credential: BiometricUnlockCredential): Promise<
  { ok: true; label: string } | { ok: false; message: string; cancelled?: boolean }
> {
  const phoneDigits = normalizePhoneDigits(credential.phoneDigits);
  const pin = credential.pin.trim();

  if (!phoneDigits || !isValidAccessPin(pin) || pin.length !== ACCESS_PIN_LENGTH) {
    return { ok: false, message: 'Credenciais inválidas para ativar a biometria.' };
  }

  const availability = await getBiometricAvailability();
  if (!availability.supported) {
    return {
      ok: false,
      message: availability.hardware
        ? 'Cadastre Face ID / impressão digital nas configurações do aparelho.'
        : 'Este aparelho não oferece biometria.',
    };
  }

  const auth = await authenticateWithBiometrics({
    promptMessage: `Confirme com ${availability.label} para ativar o acesso rápido`,
    fallbackLabel: 'Cancelar',
  });

  if (!auth.ok) {
    return {
      ok: false,
      cancelled: auth.cancelled,
      message: auth.error,
    };
  }

  const phoneSaved = await writeSecureItem(BIOMETRIC_PHONE_SECURE_KEY, phoneDigits);
  const pinSaved = await writeSecureItem(BIOMETRIC_PIN_SECURE_KEY, pin);

  if (!phoneSaved || !pinSaved) {
    await clearBiometricUnlockCredentials();
    return {
      ok: false,
      message: 'Não foi possível guardar a biometria com segurança neste aparelho.',
    };
  }

  await AsyncStorage.setItem(BIOMETRIC_UNLOCK_ENABLED_KEY, '1');
  markBiometricProcessUnlocked();

  return { ok: true, label: availability.label };
}

export async function disableBiometricUnlock() {
  await clearBiometricUnlockCredentials();
}

/**
 * Após login com PIN bem-sucedido: oferece ativar biometria (somente nativo).
 * Não bloqueia o fluxo se o usuário recusar ou se o aparelho não suportar.
 */
export async function maybeOfferEnableBiometricAfterLogin(credential: BiometricUnlockCredential) {
  if (!isBiometricPlatformSupported()) {
    return;
  }

  if (await isBiometricUnlockEnabledForPhone(credential.phoneDigits)) {
    // Atualiza o PIN guardado (ex.: senha alterada / novo login).
    await writeSecureItem(BIOMETRIC_PHONE_SECURE_KEY, normalizePhoneDigits(credential.phoneDigits));
    await writeSecureItem(BIOMETRIC_PIN_SECURE_KEY, credential.pin.trim());
    markBiometricProcessUnlocked();
    return;
  }

  if (await isBiometricUnlockEnabled()) {
    // Outro telefone estava vinculado — não sobrescreve sem consentimento.
    return;
  }

  const availability = await getBiometricAvailability();
  if (!availability.supported) {
    return;
  }

  await new Promise<void>((resolve) => {
    Alert.alert(
      `Entrar com ${availability.label}?`,
      `Na próxima vez, use ${availability.label} em vez da senha de 4 dígitos. Você poderá desativar isso em Dados Cadastrais.`,
      [
        {
          text: 'Agora não',
          style: 'cancel',
          onPress: () => resolve(),
        },
        {
          text: `Ativar ${availability.label}`,
          onPress: () => {
            void (async () => {
              const result = await enableBiometricUnlock(credential);
              if (!result.ok && !result.cancelled) {
                Alert.alert('Biometria', result.message);
              }
              resolve();
            })();
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve() }
    );
  });
}

/**
 * Prompt biométrico + leitura do PIN no SecureStore (já validado na ativação).
 * Em falha, o chamador deve cair no PIN ou login tradicional.
 */
export async function unlockWithBiometrics(expectedPhone?: string | null): Promise<
  | { ok: true; credential: BiometricUnlockCredential; label: string }
  | { ok: false; message: string; cancelled?: boolean; unavailable?: boolean }
> {
  const availability = await getBiometricAvailability();
  if (!availability.supported) {
    return {
      ok: false,
      unavailable: true,
      message: 'Biometria indisponível. Digite a senha de 4 dígitos.',
    };
  }

  const enabled = await isBiometricUnlockEnabled();
  if (!enabled) {
    return {
      ok: false,
      unavailable: true,
      message: 'Acesso biométrico não está ativo.',
    };
  }

  const storedPhone = normalizePhoneDigits(await readSecureItem(BIOMETRIC_PHONE_SECURE_KEY));
  const expectedDigits = normalizePhoneDigits(expectedPhone);

  if (expectedDigits && storedPhone && expectedDigits !== storedPhone) {
    return {
      ok: false,
      unavailable: true,
      message: 'A biometria está vinculada a outro celular. Use a senha ou entre novamente.',
    };
  }

  const auth = await authenticateWithBiometrics({
    promptMessage: `Desbloquear com ${availability.label}`,
    fallbackLabel: 'Usar senha',
  });

  if (!auth.ok) {
    return {
      ok: false,
      cancelled: auth.cancelled,
      message: auth.error,
    };
  }

  const pin = (await readSecureItem(BIOMETRIC_PIN_SECURE_KEY))?.trim() ?? '';
  if (!storedPhone || !isValidAccessPin(pin)) {
    await clearBiometricUnlockCredentials();
    return {
      ok: false,
      unavailable: true,
      message: 'Credencial biométrica inválida. Entre com a senha de 4 dígitos.',
    };
  }

  markBiometricProcessUnlocked();

  return {
    ok: true,
    label: availability.label,
    credential: {
      phoneDigits: storedPhone,
      pin,
    },
  };
}

/**
 * Quando a senha de acesso muda, atualiza a credencial biométrica se estiver ativa
 * para o mesmo telefone; caso contrário limpa.
 */
export async function syncBiometricCredentialAfterPinChange(params: {
  phone: string;
  newPin: string;
}) {
  const phoneDigits = normalizePhoneDigits(params.phone);
  const newPin = params.newPin.trim();

  if (!phoneDigits || !isValidAccessPin(newPin)) {
    return;
  }

  if (!(await isBiometricUnlockEnabledForPhone(phoneDigits))) {
    return;
  }

  await writeSecureItem(BIOMETRIC_PHONE_SECURE_KEY, phoneDigits);
  await writeSecureItem(BIOMETRIC_PIN_SECURE_KEY, newPin);
}
