import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppParameterValue } from '@/lib/appParameters';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
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

const TOTEM_PHONE_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedTotemPhones: { phones: string[]; expiresAt: number } | null = null;
let inflightTotemPhones: Promise<string[]> | null = null;

export const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

/** Dígitos locais BR (DDD + número), sem prefixo 55. */
export const canonicalPhoneDigits = (value: string | null | undefined) => {
  let digits = normalizePhoneDigits(value);

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length > 11) {
    digits = digits.slice(-11);
  }

  return digits.length >= 10 ? digits : '';
};

export const phoneDigitsMatch = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const a = canonicalPhoneDigits(left);
  const b = canonicalPhoneDigits(right);
  return Boolean(a && b && a === b);
};

export const formatPhoneForDisplay = (digits: string) => {
  const cleaned = canonicalPhoneDigits(digits) || normalizePhoneDigits(digits);
  if (cleaned.length < 10) {
    return cleaned;
  }

  const ddd = cleaned.slice(0, 2);
  const middle = cleaned.length === 11 ? cleaned.slice(2, 7) : cleaned.slice(2, 6);
  const end = cleaned.length === 11 ? cleaned.slice(7) : cleaned.slice(6);

  return `(${ddd}) ${middle}-${end}`;
};

function uniqueTotemPhones(values: Array<string | null | undefined>) {
  const phones = new Set<string>();

  for (const value of values) {
    const digits = canonicalPhoneDigits(value);

    if (digits) {
      phones.add(digits);
    }
  }

  return [...phones];
}

async function fetchCelTotemPhones(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_cel_totem_phones');

  if (!error && Array.isArray(data)) {
    const fromRpc = uniqueTotemPhones(data.map((value) => String(value ?? '')));

    if (fromRpc.length > 0) {
      return fromRpc;
    }
  }

  if (error && !isSupabaseRpcMissingError(error, 'list_cel_totem_phones')) {
    console.error('list_cel_totem_phones:', error);
  }

  const fallback = await getAppParameterValue(CEL_TOTEM_PARAMETER);
  return uniqueTotemPhones([fallback]);
}

/** Números de totem de todas as igrejas (login ainda sem tenant). */
export async function listCelTotemPhones() {
  if (cachedTotemPhones && cachedTotemPhones.expiresAt > Date.now()) {
    return cachedTotemPhones.phones;
  }

  if (inflightTotemPhones) {
    return inflightTotemPhones;
  }

  inflightTotemPhones = fetchCelTotemPhones()
    .then((phones) => {
      cachedTotemPhones = {
        phones,
        expiresAt: Date.now() + TOTEM_PHONE_CACHE_TTL_MS,
      };
      return phones;
    })
    .finally(() => {
      inflightTotemPhones = null;
    });

  return inflightTotemPhones;
}

/** Celular configurado para o dispositivo totem (parâmetro cel_totem). */
export async function getCelTotemPhone() {
  const phones = await listCelTotemPhones();
  return phones[0] ?? null;
}

export async function isTotemDevicePhone(phone: string | null | undefined) {
  if (!canonicalPhoneDigits(phone)) {
    return false;
  }

  const phones = await listCelTotemPhones();
  return phones.some((totem) => phoneDigitsMatch(phone, totem));
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
export async function persistTotemDeviceSession(phone?: string | null) {
  const phones = await listCelTotemPhones();
  const matched =
    phones.find((totem) => phoneDigitsMatch(phone, totem)) ?? phones[0] ?? null;

  if (!matched) {
    return false;
  }

  await AsyncStorage.setItem(USER_PHONE_STORAGE_KEY, formatPhoneForDisplay(matched));
  await AsyncStorage.removeItem(USER_PROFILE_ID_STORAGE_KEY);

  return true;
}
