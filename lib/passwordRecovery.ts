import {
  getAccessPinWhatsappRecipientDigits,
  loadAccessPinDeliverySettings,
  normalizePhoneForAccessPinRpc,
} from '@/lib/accessPin';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { normalizePhoneForWhatsApp, openWhatsAppPhone } from '@/lib/whatsapp';

const PASSWORD_RECOVERY_SQL_HINT =
  'Execute no Supabase: scripts/password-recovery-security.sql';

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
  if (isSupabaseRpcMissingError(error, 'password_recovery_identify')) {
    return PASSWORD_RECOVERY_SQL_HINT;
  }

  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Não foi possível concluir a operação.';

  return message;
};

export type PasswordRecoveryIdentifyResult =
  | { ok: true; securityQuestion: string }
  | { ok: false; message: string; blocked?: boolean };

export async function passwordRecoveryIdentify(
  phone: string
): Promise<PasswordRecoveryIdentifyResult> {
  const { data, error } = await supabase.rpc('password_recovery_identify', {
    p_phone: normalizePhoneForAccessPinRpc(phone),
  });

  if (error) {
    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      message:
        typeof payload?.message === 'string' ? payload.message : 'Dados não localizados',
      blocked: payload?.blocked === true,
    };
  }

  const securityQuestion =
    typeof payload.security_question === 'string' ? payload.security_question.trim() : '';

  if (!securityQuestion) {
    return { ok: false, message: 'Dados não localizados' };
  }

  return { ok: true, securityQuestion };
}

export type PasswordRecoveryVerifyChallengeResult =
  | { ok: true; message: 'Desafio Superado' }
  | { ok: false; message: string; blocked?: boolean; attemptsRemaining?: number };

export async function passwordRecoveryVerifyChallenge(
  phone: string,
  answer: string
): Promise<PasswordRecoveryVerifyChallengeResult> {
  const { data, error } = await supabase.rpc('password_recovery_verify_challenge', {
    p_phone: normalizePhoneForAccessPinRpc(phone),
    p_answer: answer,
  });

  if (error) {
    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (payload?.ok === true && payload.message === 'Desafio Superado') {
    return { ok: true, message: 'Desafio Superado' };
  }

  return {
    ok: false,
    message: typeof payload?.message === 'string' ? payload.message : 'Resposta incorreta.',
    blocked: payload?.blocked === true,
    attemptsRemaining:
      typeof payload?.attempts_remaining === 'number'
        ? payload.attempts_remaining
        : undefined,
  };
}

export type PasswordRecoveryDispatchTokenResult =
  | {
      ok: true;
      whatsappMessage: string;
      recipientDigits: string;
      sendToUser: boolean;
    }
  | { ok: false; message: string; blocked?: boolean };

export async function passwordRecoveryDispatchToken(
  phone: string
): Promise<PasswordRecoveryDispatchTokenResult> {
  const { data, error } = await supabase.rpc('password_recovery_dispatch_token', {
    p_phone: normalizePhoneForAccessPinRpc(phone),
  });

  if (error) {
    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (payload?.ok !== true) {
    return {
      ok: false,
      message:
        typeof payload?.message === 'string'
          ? payload.message
          : 'Não foi possível gerar o código.',
      blocked: payload?.blocked === true,
    };
  }

  const whatsappMessage =
    typeof payload.whatsapp_message === 'string' ? payload.whatsapp_message : '';
  const recipientDigits =
    typeof payload.recipient_digits === 'string' ? payload.recipient_digits : '';

  if (!whatsappMessage || !recipientDigits) {
    return { ok: false, message: 'Resposta inválida ao gerar o código.' };
  }

  return {
    ok: true,
    whatsappMessage,
    recipientDigits,
    sendToUser: payload.send_to_user === true,
  };
}

export type PasswordRecoveryOpenWhatsAppResult =
  | { ok: true; whatsappOpened: boolean }
  | { ok: false; message: string };

export async function passwordRecoveryOpenWhatsApp(
  phone: string,
  dispatch: Extract<PasswordRecoveryDispatchTokenResult, { ok: true }>
): Promise<PasswordRecoveryOpenWhatsAppResult> {
  const settings = await loadAccessPinDeliverySettings();
  const screenDigits = normalizePhoneForAccessPinRpc(phone);
  const configuredRecipient = getAccessPinWhatsappRecipientDigits(settings, screenDigits);

  const recipientDigits = dispatch.sendToUser
    ? screenDigits
    : dispatch.recipientDigits || configuredRecipient || '';

  const whatsappPhone = normalizePhoneForWhatsApp(recipientDigits);

  if (!whatsappPhone) {
    return {
      ok: false,
      message: dispatch.sendToUser
        ? 'Celular inválido para envio do código.'
        : 'Cadastre psw_mngr em app_parameters para envio pelo gestor.',
    };
  }

  try {
    await openWhatsAppPhone(whatsappPhone, dispatch.whatsappMessage);
    return { ok: true, whatsappOpened: true };
  } catch (error) {
    console.error('passwordRecoveryOpenWhatsApp:', error);
    return { ok: true, whatsappOpened: false };
  }
}

export type PasswordRecoveryResetPinResult =
  | { ok: true; message: string }
  | { ok: false; message: string; blocked?: boolean };

export async function passwordRecoveryResetAccessPin(
  phone: string,
  token: string,
  newPin: string
): Promise<PasswordRecoveryResetPinResult> {
  const { data, error } = await supabase.rpc('password_recovery_reset_access_pin', {
    p_phone: normalizePhoneForAccessPinRpc(phone),
    p_token: token.trim(),
    p_new_pin: newPin.trim(),
  });

  if (error) {
    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (payload?.ok === true) {
    return {
      ok: true,
      message:
        typeof payload.message === 'string'
          ? payload.message
          : 'Senha redefinida com sucesso.',
    };
  }

  return {
    ok: false,
    message:
      typeof payload?.message === 'string'
        ? payload.message
        : 'Não foi possível redefinir a senha.',
    blocked: payload?.blocked === true,
  };
}

export type ProfileSecurityQuestionState =
  | { ok: true; configured: boolean; securityQuestion: string }
  | { ok: false; message: string };

export async function loadProfileSecurityQuestion(): Promise<ProfileSecurityQuestionState> {
  const { data, error } = await supabase.rpc('get_profile_security_question');

  if (error) {
    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (payload?.ok !== true) {
    return { ok: false, message: 'Não foi possível carregar a pergunta de segurança.' };
  }

  return {
    ok: true,
    configured: payload.configured === true,
    securityQuestion:
      typeof payload.security_question === 'string' ? payload.security_question : '',
  };
}

export async function saveProfileSecurityQuestion(
  phone: string,
  currentPin: string,
  question: string,
  answer: string
): Promise<{ ok: true; securityQuestion: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('set_profile_security_question', {
    p_phone: phone,
    p_current_pin: currentPin.trim(),
    p_question: question.trim(),
    p_answer: answer,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'set_profile_security_question')) {
      return { ok: false, message: PASSWORD_RECOVERY_SQL_HINT };
    }

    return { ok: false, message: formatRpcError(error) };
  }

  const payload = parseRpcObject(data);

  if (payload?.ok !== true) {
    return { ok: false, message: 'Não foi possível salvar a pergunta de segurança.' };
  }

  return {
    ok: true,
    securityQuestion:
      typeof payload.security_question === 'string' ? payload.security_question : question.trim(),
  };
}

export { PASSWORD_RECOVERY_SQL_HINT };
