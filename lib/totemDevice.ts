import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppParameterValue } from '@/lib/appParameters';
import {
  getStoredUserPhone,
  USER_PHONE_STORAGE_KEY,
  USER_PROFILE_ID_STORAGE_KEY,
} from '@/lib/userSession';

/**
 * Celular em `app_parameters.cel_totem` é exclusivo do dispositivo totem.
 * Não usa cadastro, perfil, LGPD nem PIN de membro — apenas senha fixa 9999.
 */
export const CEL_TOTEM_PARAMETER = 'cel_totem';
export const TOTEM_ACCESS_PIN = '9999';

export const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

export const formatPhoneForDisplay = (digits: string) => {
  const cleaned = normalizePhoneDigits(digits);
  if (cleaned.length < 10) {
    return cleaned;
  }

  const ddd = cleaned.slice(0, 2);
  const middle = cleaned.length === 11 ? cleaned.slice(2, 7) : cleaned.slice(2, 6);
  const end = cleaned.length === 11 ? cleaned.slice(7) : cleaned.slice(6);

  return `(${ddd}) ${middle}-${end}`;
};

/** Celular configurado para o dispositivo totem (parâmetro cel_totem). */
export async function getCelTotemPhone() {
  const value = await getAppParameterValue(CEL_TOTEM_PARAMETER);
  const digits = normalizePhoneDigits(value);

  if (digits.length < 10) {
    return null;
  }

  return digits;
}

export async function isTotemDevicePhone(phone: string | null | undefined) {
  const celTotem = await getCelTotemPhone();

  if (!celTotem || !phone) {
    return false;
  }

  return normalizePhoneDigits(phone) === celTotem;
}

export async function isTotemDeviceSession() {
  const storedPhone = await getStoredUserPhone();
  return isTotemDevicePhone(storedPhone);
}

export const isValidTotemAccessPin = (pin: string) =>
  pin.trim() === TOTEM_ACCESS_PIN;

/** Impede fluxos de membro (cadastro, LGPD, painel) para o celular reservado ao totem. */
export async function isTotemExclusivePhone(phone: string | null | undefined) {
  return isTotemDevicePhone(phone);
}

/** Sessão mínima do totem (sem profile_id / sem fluxo de cadastro). */
export async function persistTotemDeviceSession() {
  const celTotemDigits = await getCelTotemPhone();

  if (!celTotemDigits) {
    return false;
  }

  await AsyncStorage.setItem(USER_PHONE_STORAGE_KEY, formatPhoneForDisplay(celTotemDigits));
  await AsyncStorage.removeItem(USER_PROFILE_ID_STORAGE_KEY);

  return true;
}
