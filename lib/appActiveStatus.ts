import { isAppParameterNo } from '@/lib/checkInVisibility';
import { getAppParameterValue } from '@/lib/appParameters';
import { getCachedOrFetch, invalidateAsyncCache } from '@/lib/asyncResultCache';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const APP_ATIVO_PARAMETER = 'app_ativo';
export const APP_INATIVO_MSG_PARAMETER = 'app_inativo_msg';

export const DEFAULT_APP_INACTIVE_MESSAGE =
  'O aplicativo está temporariamente indisponível. Tente novamente mais tarde.';

export type AppActiveStatus = {
  active: boolean;
  message: string;
};

const APP_ACTIVE_STATUS_CACHE_KEY = 'app:active-status';

export function resolveAppActiveFromParameter(value: string | null | undefined) {
  if (value == null || !value.trim()) {
    return true;
  }

  return !isAppParameterNo(value);
}

export function resolveAppInactiveMessage(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_APP_INACTIVE_MESSAGE;
  }

  return trimmed;
}

function coerceAppActiveBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLocaleLowerCase();

    if (normalized === 'true' || normalized === 'sim' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === 'nao' || normalized === '0') {
      return false;
    }
  }

  return null;
}

function parseAppActiveStatusPayload(data: unknown): AppActiveStatus | null {
  const record =
    typeof data === 'string'
      ? (() => {
          try {
            return JSON.parse(data) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : data && typeof data === 'object'
        ? (data as Record<string, unknown>)
        : null;

  if (!record) {
    return null;
  }

  const activeRaw = record.active ?? record.is_active;
  const messageRaw = record.message ?? record.inactive_message ?? record.app_inativo_msg;
  const active = coerceAppActiveBoolean(activeRaw);

  if (active == null) {
    return null;
  }

  return {
    active,
    message: resolveAppInactiveMessage(typeof messageRaw === 'string' ? messageRaw : null),
  };
}

async function fetchAppActiveStatusUncached(): Promise<AppActiveStatus> {
  const { data, error } = await supabase.rpc('get_app_active_status');

  if (!error) {
    const parsed = parseAppActiveStatusPayload(data);

    if (parsed) {
      return parsed;
    }
  } else if (!isSupabaseRpcMissingError(error, 'get_app_active_status')) {
    console.warn('get_app_active_status:', error);
  }

  const [ativoValue, messageValue] = await Promise.all([
    getAppParameterValue(APP_ATIVO_PARAMETER),
    getAppParameterValue(APP_INATIVO_MSG_PARAMETER),
  ]);

  return {
    active: resolveAppActiveFromParameter(ativoValue),
    message: resolveAppInactiveMessage(messageValue),
  };
}

/** Status global do app (app_ativo + app_inativo_msg), com cache curto. */
export async function loadAppActiveStatus(options?: {
  forceRefresh?: boolean;
}): Promise<AppActiveStatus> {
  return getCachedOrFetch(APP_ACTIVE_STATUS_CACHE_KEY, fetchAppActiveStatusUncached, {
    ttlMs: 60_000,
    forceRefresh: options?.forceRefresh,
  });
}

export function clearAppActiveStatusCache() {
  invalidateAsyncCache(APP_ACTIVE_STATUS_CACHE_KEY);
}

type AppActiveSessionListener = () => void | Promise<void>;

let appActiveSessionListener: AppActiveSessionListener | null = null;

export function registerAppActiveSessionListener(listener: AppActiveSessionListener | null) {
  appActiveSessionListener = listener;
}

/** Revalida bypass de super_admin logo após persistir a sessão no login. */
export async function notifyAppActiveSessionEstablished() {
  await appActiveSessionListener?.();
}
