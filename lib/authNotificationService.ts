/**
 * Gateway único de notificação de autenticação (PIN).
 * Canal imutável: apenas e-mail. WhatsApp é bloqueado por hard-code.
 *
 * Não importar `@/lib/accessPin` daqui (evita dependência circular com o login).
 */
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

const normalizePhoneForAccessPinRpc = (phone: string) => phone.replace(/\D/g, '');

export const AUTH_NOTIFICATION_CHANNEL = 'email' as const;
export type AuthNotificationChannel = typeof AUTH_NOTIFICATION_CHANNEL;

export const AUTH_CHANNEL_BLOCKED_MESSAGE =
  'AUTH_CHANNEL_BLOCKED: autenticação só pode enviar PIN por e-mail. WhatsApp está desativado neste fluxo.';

export const AUTH_PIN_EMAIL_SQL_HINT =
  'Execute no Supabase: scripts/auth-pin-email-only.sql (após password-recovery-email-flow.sql e preparar-perfil-acesso-cadastro.sql).';

/** Preferência obrigatória para autenticação — nunca WhatsApp. */
export const AUTH_PREFERRED_CHANNEL = 'email' as const;

export function assertAuthNotificationChannel(
  channel: string
): asserts channel is AuthNotificationChannel {
  if (channel !== AUTH_NOTIFICATION_CHANNEL) {
    console.error(AUTH_CHANNEL_BLOCKED_MESSAGE, { channel });
    throw new Error(AUTH_CHANNEL_BLOCKED_MESSAGE);
  }
}

/** Bloqueio explícito de qualquer tentativa de envio de PIN via WhatsApp. */
export function rejectAuthWhatsAppDelivery(context: string): never {
  console.error(AUTH_CHANNEL_BLOCKED_MESSAGE, { context });
  throw new Error(AUTH_CHANNEL_BLOCKED_MESSAGE);
}

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
}

export type DispatchAuthPinResult =
  | { ok: true; message: string; emailMasked: string; channel: AuthNotificationChannel }
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

  return {
    ok: true,
    channel: AUTH_NOTIFICATION_CHANNEL,
    message:
      typeof payload?.message === 'string'
        ? payload.message
        : 'Código de acesso enviado por e-mail.',
    emailMasked: typeof payload?.email_masked === 'string' ? payload.email_masked : '',
  };
}
