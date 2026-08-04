/**
 * Implementação web do atalho biométrico — no-ops seguros.
 * Native: `biometricAuth.native.ts` (Face ID / Touch ID / impressão).
 * Telefone+PIN permanece o login principal em todas as plataformas.
 */
export const BIOMETRIC_UNLOCK_ENABLED_KEY = 'biometric_unlock_enabled';

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

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  return { supported: false, hardware: false, enrolled: false, label: 'Biometria' };
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  return false;
}

export async function promptBiometricUnlock(_label = 'Biometria'): Promise<boolean> {
  return false;
}

export async function enableBiometricUnlock(_payload: BiometricUnlockPayload): Promise<{
  ok: boolean;
  message?: string;
  label: string;
}> {
  return {
    ok: false,
    label: 'Biometria',
    message: 'Biometria disponível apenas no aplicativo nativo (Android/iOS).',
  };
}

export async function disableBiometricUnlock(): Promise<void> {
  // no-op no PWA
}

export async function unlockSessionWithBiometrics(): Promise<{
  ok: boolean;
  phone?: string;
  profile?: Record<string, unknown>;
  sessionToken?: string | null;
  message?: string;
  label?: string;
}> {
  return {
    ok: false,
    label: 'Biometria',
    message: 'Biometria disponível apenas no aplicativo nativo.',
  };
}

export async function maybeOfferBiometricEnrollment(
  _payload: BiometricUnlockPayload
): Promise<void> {
  // no-op no PWA
}
