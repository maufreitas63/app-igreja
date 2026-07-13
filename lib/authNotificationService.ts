/**
 * Gateway único de notificação de autenticação (PIN).
 * Canal imutável: apenas e-mail. WhatsApp é bloqueado por hard-code.
 *
 * Não importar `@/lib/accessPin` daqui (evita dependência circular com o login).
 */
import {
  AUTH_CHANNEL_BLOCKED_MESSAGE,
  AUTH_NOTIFICATION_CHANNEL,
  AUTH_PIN_EMAIL_SQL_HINT,
  AUTH_PREFERRED_CHANNEL,
  assertAuthNotificationChannel,
  type AuthNotificationChannel,
} from '@/lib/authChannelGuard';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export {
  AUTH_CHANNEL_BLOCKED_MESSAGE,
  AUTH_NOTIFICATION_CHANNEL,
  AUTH_PIN_EMAIL_SQL_HINT,
  AUTH_PREFERRED_CHANNEL,
  assertAuthNotificationChannel,
};
export type { AuthNotificationChannel };

const normalizePhoneForAccessPinRpc = (phone: string) => phone.replace(/\D/g, '');

const parseRpcObject = (data: unknown): Record<string, unknown> | null => {
  let payload: unknown = data;

  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (Array.isArray(payload)) {
    const first = payload[0];
    payload = first && typeof first === 'object' ? first : null;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload as Record<string, unknown>;
};

const formatRpcError = (error: unknown) => {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Não foi possível enviar o código de acesso.';

  if (
    isSupabaseRpcMissingError({ message }, 'dispatch_auth_access_pin_email')
    || isSupabaseRpcMissingError({ message }, 'auth_pin_get_delivery_state')
  ) {
    return AUTH_PIN_EMAIL_SQL_HINT;
  }

  if (message.includes('AUTH_CHANNEL_BLOCKED')) {
    return AUTH_CHANNEL_BLOCKED_MESSAGE;
  }

  return message;
};

export type AuthPinDeliveryState =
  | {
      ok: true;
      hasPin: boolean;
      needsEmail: boolean;
      emailMasked: string;
      preferredChannel: AuthNotificationChannel;
    }
  | { ok: false; message: string };

export async function getAuthPinDeliveryState(phone: string): Promise<AuthPinDeliveryState> {
  try {
    assertAuthNotificationChannel(AUTH_NOTIFICATION_CHANNEL);

    const { data, error } = await supabase.rpc('auth_pin_get_delivery_state', {
      p_phone: normalizePhoneForAccessPinRpc(phone),
    });

    if (error) {
      return { ok: false, message: formatRpcError(error) };
    }

    const payload = parseRpcObject(data);

    if (!coerceRpcBoolean(payload?.ok)) {
      return {
        ok: false,
        message:
          typeof payload?.message === 'string'
            ? payload.message
            : 'Não foi possível verificar o envio do código.',
      };
    }

    return {
      ok: true,
      hasPin: payload?.has_pin === true,
      needsEmail: payload?.needs_email === true,
      emailMasked: typeof payload?.email_masked === 'string' ? payload.email_masked : '',
      preferredChannel: AUTH_NOTIFICATION_CHANNEL,
    };
  } catch (error) {
    return { ok: false, message: formatRpcError(error) };
  }
}

export type DispatchAuthPinResult =
  | {
      ok: true;
      message: string;
      emailMasked: string;
      channel: AuthNotificationChannel;
      resendId?: string;
    }
  | { ok: false; message: string; needsEmail?: boolean };

/**
 * Único caminho operacional para PIN de autenticação (primeira entrada).
 * Sempre e-mail; qualquer outro canal é rejeitado.
 */
export async function dispatchAuthAccessPinEmail(params: {
  phone: string;
  email?: string;
  emailConfirm?: string;
  purpose?: 'first_access' | 'password_recovery';
}): Promise<DispatchAuthPinResult> {
  try {
    assertAuthNotificationChannel(AUTH_NOTIFICATION_CHANNEL);

    const purpose = params.purpose ?? 'first_access';

    if (purpose !== 'first_access' && purpose !== 'password_recovery') {
      return { ok: false, message: AUTH_CHANNEL_BLOCKED_MESSAGE };
    }

    const { data, error } = await supabase.rpc('dispatch_auth_access_pin_email', {
      p_phone: normalizePhoneForAccessPinRpc(params.phone),
      p_email: params.email?.trim() || null,
      p_email_confirm: params.emailConfirm?.trim() || null,
    });

    if (error) {
      return { ok: false, message: formatRpcError(error) };
    }

    const payload = parseRpcObject(data);

    if (!coerceRpcBoolean(payload?.ok)) {
      return {
        ok: false,
        message:
          typeof payload?.message === 'string'
            ? payload.message
            : 'Não foi possível enviar o código por e-mail.',
        needsEmail: payload?.needs_email === true,
      };
    }

    const resendId =
      typeof payload?.resend_id === 'string'
        ? payload.resend_id
        : typeof payload?.resendId === 'string'
          ? payload.resendId
          : undefined;

    return {
      ok: true,
      channel: AUTH_NOTIFICATION_CHANNEL,
      message:
        typeof payload?.message === 'string'
          ? payload.message
          : 'Código de acesso enviado por e-mail.',
      emailMasked: typeof payload?.email_masked === 'string' ? payload.email_masked : '',
      resendId,
    };
  } catch (error) {
    return { ok: false, message: formatRpcError(error) };
  }
}
