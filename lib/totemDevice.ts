import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppParameterValue } from '@/lib/appParameters';
import { canonicalPhoneDigits, normalizePhoneDigits } from '@/lib/phoneDigits';
import {
  USER_PHONE_STORAGE_KEY,
  USER_PROFILE_ID_STORAGE_KEY,
} from '@/lib/sessionStorageKeys';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

/**
 * Celular e senha do totem são por instância (`igrejas.cel_totem` / `senha_totem`).
 * Não usa cadastro, perfil, LGPD nem PIN de membro.
 */
export { canonicalPhoneDigits, normalizePhoneDigits } from '@/lib/phoneDigits';

export const CEL_TOTEM_PARAMETER = 'cel_totem';
/** Padrão só quando a instância ainda não cadastrou senha própria. */
export const TOTEM_ACCESS_PIN = '9999';
export const TOTEM_CREDENTIALS_SQL_HINT =
  'Execute no Supabase: scripts/igreja-totem-credentials.sql';

const TOTEM_PHONE_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedTotemPhones: { phones: string[]; expiresAt: number } | null = null;
let inflightTotemPhones: Promise<string[]> | null = null;

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

const TOTEM_PHONE_FETCH_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function fetchCelTotemPhones(): Promise<string[]> {
  try {
    return await withTimeout(
      (async () => {
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
      })(),
      TOTEM_PHONE_FETCH_TIMEOUT_MS
    );
  } catch (error) {
    console.warn('list_cel_totem_phones timeout/fallback:', error);
    return [];
  }
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
  const storedPhone = await AsyncStorage.getItem(USER_PHONE_STORAGE_KEY);
  return isTotemDevicePhone(storedPhone);
}

export const isValidTotemAccessPin = (pin: string) => /^\d{4}$/.test(pin.trim());

export function clearTotemPhoneCache() {
  cachedTotemPhones = null;
  inflightTotemPhones = null;
}

function parseTotemRpcPayload(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

export type TotemLoginResult = {
  ok: boolean;
  phone: string | null;
  message: string;
};

/** Confere celular + senha na instância ativa (código informado no login). */
export async function verifyTotemLogin(
  phone: string | null | undefined,
  password: string
): Promise<TotemLoginResult> {
  const { data, error } = await supabase.rpc('verify_totem_login', {
    p_phone: canonicalPhoneDigits(phone) || String(phone ?? ''),
    p_password: password.trim(),
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'verify_totem_login')) {
      return {
        ok: false,
        phone: null,
        message: TOTEM_CREDENTIALS_SQL_HINT,
      };
    }

    return {
      ok: false,
      phone: null,
      message: error.message?.trim() || 'Não foi possível validar o totem.',
    };
  }

  const payload = parseTotemRpcPayload(data);
  const matched = canonicalPhoneDigits(
    typeof payload.phone === 'string' ? payload.phone : null
  );

  return {
    ok: payload.ok === true,
    phone: matched || null,
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : payload.ok === true
          ? 'Totem autenticado.'
          : 'Senha do totem incorreta.',
  };
}

/** Kiosk: o celular da sessão precisa ser o totem da instância ativa. */
export async function verifyTotemSessionPhone(
  phone: string | null | undefined
): Promise<TotemLoginResult> {
  const { data, error } = await supabase.rpc('verify_totem_session_phone', {
    p_phone: canonicalPhoneDigits(phone) || String(phone ?? ''),
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'verify_totem_session_phone')) {
      return { ok: false, phone: null, message: TOTEM_CREDENTIALS_SQL_HINT };
    }

    return {
      ok: false,
      phone: null,
      message: error.message?.trim() || 'Não foi possível validar o totem.',
    };
  }

  const payload = parseTotemRpcPayload(data);
  const matched = canonicalPhoneDigits(
    typeof payload.phone === 'string' ? payload.phone : null
  );

  return {
    ok: payload.ok === true,
    phone: matched || null,
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : payload.ok === true
          ? 'Totem autenticado.'
          : 'O totem desta instância não está vinculado a este aparelho.',
  };
}

/** Impede fluxos de membro (cadastro, LGPD, painel) para o celular reservado ao totem. */
export async function isTotemExclusivePhone(phone: string | null | undefined) {
  return isTotemDevicePhone(phone);
}

/** Sessão mínima do totem (sem profile_id / sem fluxo de cadastro). */
export async function persistTotemDeviceSession(phone?: string | null) {
  const matched = canonicalPhoneDigits(phone);

  if (!matched) {
    return false;
  }

  await AsyncStorage.setItem(USER_PHONE_STORAGE_KEY, formatPhoneForDisplay(matched));
  await AsyncStorage.removeItem(USER_PROFILE_ID_STORAGE_KEY);

  return true;
}
