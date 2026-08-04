import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Preferência local: biometria ativada neste aparelho (atalho; não substitui telefone+PIN). */
export const BIOMETRIC_UNLOCK_ENABLED_KEY = 'biometric_unlock_enabled';

/** Credenciais de desbloqueio no SecureStore (nunca grava o PIN). */
const BIOMETRIC_UNLOCK_PAYLOAD_KEY = 'biometric_unlock_payload';

export type BiometricUnlockPayload = {
  phone: string;
  profileId: string;
};

export type BiometricAvailability = {
  supported: boolean;
  hardware: boolean;
  enrolled: boolean;
  label: string;
};

function isNativeMobilePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function getBiometricMethodLabel(types: LocalAuthentication.AuthenticationType[]): string {
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const hasIris = types.includes(LocalAuthentication.AuthenticationType.IRIS);

  if (Platform.OS === 'ios') {
    if (hasFace) return 'Face ID';
    if (hasFinger) return 'Touch ID';
    return 'Biometria';
  }

  if (hasFinger && hasFace) return 'Biometria';
  if (hasFinger) return 'Impressão digital';
  if (hasFace || hasIris) return 'Reconhecimento facial';
  return 'Biometria';
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (!isNativeMobilePlatform()) {
    return { supported: false, hardware: false, enrolled: false, label: 'Biometria' };
  }

  try {
    const [hardware, enrolled, types, secureStoreOk] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      SecureStore.isAvailableAsync(),
    ]);

    const label = getBiometricMethodLabel(types);
    const supported = Boolean(hardware && enrolled && secureStoreOk);

    return { supported, hardware, enrolled, label };
  } catch (error) {
    console.warn('getBiometricAvailability:', error);
    return { supported: false, hardware: false, enrolled: false, label: 'Biometria' };
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  if (!isNativeMobilePlatform()) {
    return false;
  }

  try {
    const flag = await AsyncStorage.getItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
    if (flag !== '1') {
      return false;
    }

    const payload = await readBiometricUnlockPayload();
    return Boolean(payload?.phone && payload?.profileId);
  } catch {
    return false;
  }
}

async function readBiometricUnlockPayload(): Promise<BiometricUnlockPayload | null> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_UNLOCK_PAYLOAD_KEY);
    if (!raw?.trim()) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<BiometricUnlockPayload>;
    const phone = typeof parsed.phone === 'string' ? parsed.phone.replace(/\D/g, '') : '';
    const profileId = typeof parsed.profileId === 'string' ? parsed.profileId.trim() : '';

    if (!phone || !profileId) {
      return null;
    }

    return { phone, profileId };
  } catch (error) {
    console.warn('readBiometricUnlockPayload:', error);
    return null;
  }
}

export async function promptBiometricUnlock(label = 'Biometria'): Promise<boolean> {
  if (!isNativeMobilePlatform()) {
    return false;
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Entrar com ${label}`,
      cancelLabel: 'Usar senha',
      fallbackLabel: 'Usar senha',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'weak',
    });

    return result.success === true;
  } catch (error) {
    console.warn('promptBiometricUnlock:', error);
    return false;
  }
}

export async function enableBiometricUnlock(payload: BiometricUnlockPayload): Promise<{
  ok: boolean;
  message?: string;
  label: string;
}> {
  const availability = await getBiometricAvailability();

  if (!availability.supported) {
    return {
      ok: false,
      label: availability.label,
      message: availability.hardware
        ? 'Cadastre Face ID, Touch ID ou impressão digital nas configurações do aparelho.'
        : 'Este aparelho não oferece autenticação biométrica.',
    };
  }

  const confirmed = await promptBiometricUnlock(availability.label);
  if (!confirmed) {
    return {
      ok: false,
      label: availability.label,
      message: 'Biometria não confirmada. Você pode continuar entrando com o celular e a senha.',
    };
  }

  const phone = payload.phone.replace(/\D/g, '');
  const profileId = payload.profileId.trim();

  if (!phone || !profileId) {
    return {
      ok: false,
      label: availability.label,
      message: 'Não foi possível vincular a biometria a este perfil.',
    };
  }

  try {
    await SecureStore.setItemAsync(
      BIOMETRIC_UNLOCK_PAYLOAD_KEY,
      JSON.stringify({ phone, profileId } satisfies BiometricUnlockPayload)
    );
    await AsyncStorage.setItem(BIOMETRIC_UNLOCK_ENABLED_KEY, '1');
    return { ok: true, label: availability.label };
  } catch (error) {
    console.warn('enableBiometricUnlock:', error);
    return {
      ok: false,
      label: availability.label,
      message: 'Não foi possível salvar a biometria neste aparelho.',
    };
  }
}

export async function disableBiometricUnlock(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
  } catch {
    // best-effort
  }

  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_UNLOCK_PAYLOAD_KEY);
  } catch {
    // best-effort
  }
}

/**
 * Desbloqueia a sessão via biometria e restaura telefone + profile_id + token.
 * O PIN nunca é armazenado; um novo token é emitido no servidor após a biometria.
 */
export async function unlockSessionWithBiometrics(): Promise<{
  ok: boolean;
  phone?: string;
  profile?: Record<string, unknown>;
  sessionToken?: string | null;
  message?: string;
  label?: string;
}> {
  const availability = await getBiometricAvailability();
  const enabled = await isBiometricUnlockEnabled();

  if (!enabled) {
    return { ok: false, label: availability.label, message: 'Biometria não está ativada neste aparelho.' };
  }

  if (!availability.supported) {
    return {
      ok: false,
      label: availability.label,
      message: 'Biometria indisponível. Use o celular e a senha de 4 dígitos.',
    };
  }

  const confirmed = await promptBiometricUnlock(availability.label);
  if (!confirmed) {
    return {
      ok: false,
      label: availability.label,
      message: 'Biometria cancelada. Digite a senha de 4 dígitos para entrar.',
    };
  }

  const payload = await readBiometricUnlockPayload();
  if (!payload) {
    await disableBiometricUnlock();
    return {
      ok: false,
      label: availability.label,
      message: 'Cadastro biométrico inválido. Entre com a senha e ative novamente.',
    };
  }

  try {
    const { loadProfileByPhone } = await import('@/lib/profileOnboarding');
    const { persistUserSession, resolveProfileId } = await import('@/lib/userSession');

    const profile = await loadProfileByPhone(payload.phone);
    const profileId = resolveProfileId(profile);

    if (!profile || !profileId || profileId !== payload.profileId) {
      await disableBiometricUnlock();
      return {
        ok: false,
        label: availability.label,
        message: 'Perfil não encontrado. Entre com o celular e a senha.',
      };
    }

    await persistUserSession(profile, payload.phone, null);

    const { getStoredSessionToken } = await import('@/lib/userSession');
    const sessionToken = await getStoredSessionToken();

    return {
      ok: true,
      phone: payload.phone,
      profile,
      sessionToken,
      label: availability.label,
    };
  } catch (error) {
    console.warn('unlockSessionWithBiometrics:', error);
    return {
      ok: false,
      label: availability.label,
      message: 'Não foi possível entrar com biometria. Use a senha de 4 dígitos.',
    };
  }
}

export async function maybeOfferBiometricEnrollment(payload: BiometricUnlockPayload): Promise<void> {
  if (!isNativeMobilePlatform()) {
    return;
  }

  if (await isBiometricUnlockEnabled()) {
    return;
  }

  const availability = await getBiometricAvailability();
  if (!availability.supported) {
    return;
  }

  const { Alert } = await import('react-native');

  await new Promise<void>((resolve) => {
    Alert.alert(
      `Entrar com ${availability.label}`,
      `Deseja usar ${availability.label} para entrar mais rápido nas próximas vezes?\n\nO acesso com celular e senha de 4 dígitos continua disponível.`,
      [
        {
          text: 'Agora não',
          style: 'cancel',
          onPress: () => resolve(),
        },
        {
          text: 'Ativar',
          onPress: () => {
            void (async () => {
              const result = await enableBiometricUnlock(payload);
              if (!result.ok && result.message) {
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
