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

function parseAppActiveStatusPayload(data: unknown): AppActiveStatus | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const activeRaw = record.active ?? record.is_active;
  const messageRaw = record.message ?? record.inactive_message ?? record.app_inativo_msg;

  if (typeof activeRaw !== 'boolean') {
    return null;
  }

  return {
    active: activeRaw,
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
