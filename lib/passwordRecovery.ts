import { normalizePhoneForAccessPinRpc } from '@/lib/accessPin';
import {
  AUTH_NOTIFICATION_CHANNEL,
  assertAuthNotificationChannel,
} from '@/lib/authChannelGuard';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

const PASSWORD_RECOVERY_SQL_HINT =
  'Execute no Supabase: scripts/password-recovery-security.sql, scripts/password-recovery-email-flow.sql e scripts/password-recovery-remove-security-question-patch.sql';

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

const PASSWORD_RECOVERY_RPCS = [
  'password_recovery_get_state',
  'password_recovery_set_email',
  'password_recovery_send_pin',
  'password_recovery_verify_and_send_pin',
  'password_recovery_verify_challenge_and_dispatch',
] as const;

const formatRpcError = (error: unknown) => {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Não foi possível concluir a operação.';

  if (PASSWORD_RECOVERY_RPCS.some((rpc) => isSupabaseRpcMissingError({ message }, rpc))) {
    return PASSWORD_RECOVERY_SQL_HINT;
  }

  return message;
};

const isRecoveryPayloadOk = (payload: Record<string, unknown> | null) =>
  coerceRpcBoolean(payload?.ok);

export type PasswordRecoveryStateResult =
  | {
      ok: true;
      needsEmail: boolean;
      emailMasked: string;
    }
  | { ok: false; message: string; blocked?: boolean };

export async function passwordRecoveryGetState(
  phone: string
): Promise<PasswordRecoveryStateResult> {
  const { data, error } = await supabase.rpc('password_recovery_get_state', {
    p_phone: normalizePhoneForAccessPinRpc(phone),
  });

  if (error) {
    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (!isRecoveryPayloadOk(payload)) {
    return {
      ok: false,
      message:
        typeof payload?.message === 'string' ? payload.message : 'Dados não localizados',
      blocked: payload?.blocked === true,
    };
  }

  return {
    ok: true,
    needsEmail: payload?.needs_email === true,
    emailMasked:
      typeof payload?.email_masked === 'string' ? payload.email_masked : '',
  };
}

export type PasswordRecoverySetEmailResult =
  | { ok: true; emailMasked: string }
  | { ok: false; message: string; blocked?: boolean };

export async function passwordRecoverySetEmail(
  phone: string,
  email: string,
  emailConfirm: string
): Promise<PasswordRecoverySetEmailResult> {
  const { data, error } = await supabase.rpc('password_recovery_set_email', {
    p_phone: normalizePhoneForAccessPinRpc(phone),
    p_email: email.trim(),
    p_email_confirm: emailConfirm.trim(),
  });

  if (error) {
    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (!isRecoveryPayloadOk(payload)) {
    return {
      ok: false,
      message:
        typeof payload?.message === 'string'
          ? payload.message
          : 'Não foi possível salvar o e-mail.',
      blocked: payload?.blocked === true,
    };
  }

  return {
    ok: true,
    emailMasked:
      typeof payload?.email_masked === 'string' ? payload.email_masked : '',
  };
}

export type PasswordRecoverySendPinResult =
  | { ok: true; message: string; emailMasked: string }
  | { ok: false; message: string; blocked?: boolean };

export async function passwordRecoverySendPin(
  phone: string
): Promise<PasswordRecoverySendPinResult> {
  assertAuthNotificationChannel(AUTH_NOTIFICATION_CHANNEL);

  const normalizedPhone = normalizePhoneForAccessPinRpc(phone);

  const { data, error } = await supabase.rpc('password_recovery_send_pin', {
    p_phone: normalizedPhone,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'password_recovery_send_pin')) {
      return {
        ok: false,
        message: PASSWORD_RECOVERY_SQL_HINT,
      };
    }

    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (!isRecoveryPayloadOk(payload)) {
    return {
      ok: false,
      message:
        typeof payload?.message === 'string'
          ? payload.message
          : 'Não foi possível enviar a nova senha.',
      blocked: payload?.blocked === true,
    };
  }

  return {
    ok: true,
    message:
      typeof payload?.message === 'string'
        ? payload.message
        : 'Nova senha enviada por e-mail.',
    emailMasked:
      typeof payload?.email_masked === 'string' ? payload.email_masked : '',
  };
}

export { PASSWORD_RECOVERY_SQL_HINT };
