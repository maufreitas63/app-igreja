import {
  AUTH_CHANNEL_BLOCKED_MESSAGE,
  AUTH_PIN_EMAIL_SQL_HINT,
  rejectAuthWhatsAppDelivery,
} from '@/lib/authChannelGuard';
import { getAppParameterValue } from '@/lib/appParameters';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const ACCESS_PIN_LENGTH = 4;

const normalizeDigits = (value: string) => value.replace(/\D/g, '');

/** Telefone enviado às RPCs do Supabase (sempre só dígitos, com DDD). */
export const normalizePhoneForAccessPinRpc = (phone: string) => normalizeDigits(phone);

export const isValidAccessPin = (pin: string) => /^\d{4}$/.test(pin.trim());

export const formatAccessPinDisplay = (pin: string | null | undefined) => {
  const digits = normalizeDigits(String(pin ?? ''));

  if (!digits) {
    return '—';
  }

  return digits.padStart(ACCESS_PIN_LENGTH, '0').slice(-ACCESS_PIN_LENGTH);
};

const normalizeAppParameterValue = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Valores de `psw_user` que enviam a senha temporária ao celular digitado na tela. */
const PSW_USER_SEND_TO_MEMBER = ['sim', 's', 'yes', 'y', '1', 'true', 'verdadeiro'] as const;

/**
 * `app_parameters.psw_user`:
 * - `sim` (e equivalentes) → WhatsApp do celular informado na tela de login.
 * - `nao` (e equivalentes) → WhatsApp do gestor em `psw_mngr`.
 * - outro valor / vazio → gestor (`psw_mngr`), mesmo critério de `nao`.
 */
export const parsePswUserParameter = (value: string | null | undefined) => {
  const normalized = normalizeAppParameterValue(value);
  return PSW_USER_SEND_TO_MEMBER.includes(normalized as (typeof PSW_USER_SEND_TO_MEMBER)[number]);
};

export const shouldSendAccessPinToManager = (value: string | null | undefined) => {
  const normalized = normalizeAppParameterValue(value);

  if (PSW_USER_SEND_TO_MEMBER.includes(normalized as (typeof PSW_USER_SEND_TO_MEMBER)[number])) {
    return false;
  }

  return true;
};

export type AccessPinDeliveryTarget = 'user' | 'manager';

export type AccessPinDeliveryPlan = {
  sendToUser: boolean;
  target: AccessPinDeliveryTarget;
  recipientDigits: string;
  recipientLabel: string;
};

/** Configuração global (psw_user / psw_mngr) — não depende do celular digitado. */
export type AccessPinDeliverySettings = {
  sendToUser: boolean;
  managerDigits: string;
  recipientLabel: string;
};

let cachedDeliverySettings: AccessPinDeliverySettings | null = null;

export async function loadAccessPinDeliverySettings(
  forceReload = false
): Promise<AccessPinDeliverySettings> {
  if (!forceReload && cachedDeliverySettings) {
    return cachedDeliverySettings;
  }

  const pswUser = await getAppParameterValue('psw_user');
  const sendToUser = parsePswUserParameter(pswUser);
  const managerPhone = sendToUser ? null : await getAppParameterValue('psw_mngr');

  cachedDeliverySettings = {
    sendToUser,
    managerDigits: managerPhone ? normalizeDigits(managerPhone) : '',
    recipientLabel: sendToUser
      ? 'seu WhatsApp (celular informado na tela)'
      : 'o WhatsApp do gestor (psw_mngr)',
  };

  return cachedDeliverySettings;
}

const hasMinimumPhoneDigits = (digits: string) => normalizeDigits(digits).length >= 10;

/** Destino do wa.me a partir dos parâmetros do Supabase + celular da tela (se psw_user = sim). */
export function getAccessPinWhatsappRecipientDigits(
  settings: AccessPinDeliverySettings,
  screenPhoneDigits: string
): string | null {
  if (settings.sendToUser) {
    return hasMinimumPhoneDigits(screenPhoneDigits) ? normalizeDigits(screenPhoneDigits) : null;
  }

  return hasMinimumPhoneDigits(settings.managerDigits)
    ? normalizeDigits(settings.managerDigits)
    : null;
}

/** Define destino legado (psw_user / psw_mngr) — não usado para envio de PIN de autenticação. */
export async function resolveAccessPinDelivery(screenPhone: string): Promise<AccessPinDeliveryPlan> {
  const pswUser = await getAppParameterValue('psw_user');
  const sendToUser = parsePswUserParameter(pswUser);

  if (sendToUser) {
    return {
      sendToUser: true,
      target: 'user',
      recipientDigits: normalizeDigits(screenPhone),
      recipientLabel: 'seu WhatsApp (celular informado na tela)',
    };
  }

  const managerPhone = await getAppParameterValue('psw_mngr');

  return {
    sendToUser: false,
    target: 'manager',
    recipientDigits: managerPhone ? normalizeDigits(managerPhone) : '',
    recipientLabel: 'o WhatsApp do gestor (psw_user = nao, parâmetro psw_mngr)',
  };
}

export async function resolveAccessPinRecipientPhone(screenPhone: string) {
  const plan = await resolveAccessPinDelivery(screenPhone);
  return plan.recipientDigits || null;
}

export async function resolveAccessPinRecipientLabel(screenPhone: string) {
  const plan = await resolveAccessPinDelivery(screenPhone);
  return plan.recipientLabel;
}

/** Celular de destino do Zap (gestor ou usuário), para abrir wa.me no clique. */
export async function resolveAccessPinRecipientDigits(screenPhone: string) {
  const plan = await resolveAccessPinDelivery(screenPhone);
  return plan.recipientDigits || null;
}

/** @deprecated Prefira `getAccessPinWhatsappRecipientDigits(settings, screenPhoneDigits)`. */
export function resolveAccessPinWhatsappRecipientDigits(
  prepared: PreparedAccessPinDraft,
  screenPhoneDigits: string
): string | null {
  return getAccessPinWhatsappRecipientDigits(
    {
      sendToUser: prepared.sendToUser,
      managerDigits: prepared.sendToUser ? '' : normalizeDigits(prepared.recipientDigits),
      recipientLabel: prepared.recipientLabel,
    },
    screenPhoneDigits
  );
}

export type VerifyAccessPinResult =
  | { ok: true; profile: Record<string, unknown> }
  | { ok: false; reason: 'not_found' | 'pin_not_set' | 'pin_invalid' | 'rpc_error' };

const parseRpcJsonPayload = (data: unknown): Record<string, unknown> | null => {
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

const mapVerifyAccessPinFailure = (
  payload: Record<string, unknown> | null
): VerifyAccessPinResult => {
  if (!payload) {
    return { ok: false, reason: 'not_found' };
  }

  const errorCode = typeof payload.error === 'string' ? payload.error.trim() : '';

  if (errorCode === 'pin_not_set') {
    return { ok: false, reason: 'pin_not_set' };
  }

  if (errorCode === 'pin_invalid') {
    return { ok: false, reason: 'pin_invalid' };
  }

  if (payload.verified === false || payload.verified === 'false') {
    return { ok: false, reason: 'pin_invalid' };
  }

  return { ok: false, reason: 'rpc_error' };
};

export async function profileHasAccessPin(phone: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('profile_has_access_pin', {
    p_phone: normalizePhoneForAccessPinRpc(phone),
  });

  if (error) {
    console.error('profile_has_access_pin:', error);
    return null;
  }

  return data === true;
}

export async function verifyProfileAccessPin(
  phone: string,
  pin: string
): Promise<VerifyAccessPinResult> {
  const { data, error } = await supabase.rpc('verify_profile_access_pin', {
    p_phone: phone,
    p_pin: pin.trim(),
  });

  if (error) {
    console.error('verify_profile_access_pin:', error);
    return { ok: false, reason: 'rpc_error' };
  }

  const payload = parseRpcJsonPayload(data);

  if (!payload) {
    return { ok: false, reason: 'not_found' };
  }

  const errorCode = typeof payload.error === 'string' ? payload.error.trim() : '';

  if (errorCode) {
    return mapVerifyAccessPinFailure(payload);
  }

  if (payload.verified === true || payload.verified === 'true') {
    if (!payload.id) {
      return { ok: false, reason: 'not_found' };
    }

    return { ok: true, profile: payload };
  }

  if (payload.verified === false || payload.verified === 'false') {
    return mapVerifyAccessPinFailure(payload);
  }

  return { ok: false, reason: 'rpc_error' };
}

const parsePrepareVisitorPayload = (data: unknown): { pin: string; profileId: string } | null => {
  let payload: unknown = data;

  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (record.ok === false || record.ok === 'false') {
    return null;
  }

  const pin = typeof record.pin === 'string' ? record.pin.trim() : '';

  if (!isValidAccessPin(pin)) {
    return null;
  }

  const profileId = typeof record.profile_id === 'string' ? record.profile_id : '';

  return { pin, profileId };
};

/** Garante linha em `profiles` para celular novo (visitante). */
export async function ensureProfileForAccessPin(phone: string) {
  const p_phone = normalizePhoneForAccessPinRpc(phone);

  const { error } = await supabase.rpc('ensure_profile_for_access_pin', {
    p_phone,
  });

  if (!error) {
    return;
  }

  if (isSupabaseRpcMissingError(error, 'ensure_profile_for_access_pin')) {
    throw new Error(
      'Função ensure_profile_for_access_pin não encontrada. Execute scripts/preparar-perfil-acesso-cadastro.sql no Supabase.'
    );
  }

  throw error;
}

export async function regenerateProfileAccessPin(phone: string) {
  const p_phone = normalizePhoneForAccessPinRpc(phone);

  const { data: visitorData, error: visitorError } = await supabase.rpc(
    'prepare_visitor_access_pin',
    { p_phone }
  );

  if (!visitorError) {
    const parsed = parsePrepareVisitorPayload(visitorData);

    if (parsed) {
      return parsed.pin;
    }
  } else if (!isSupabaseRpcMissingError(visitorError, 'prepare_visitor_access_pin')) {
    throw visitorError;
  }

  await ensureProfileForAccessPin(p_phone);

  const { data, error } = await supabase.rpc('regenerate_profile_access_pin', {
    p_phone,
  });

  if (error) {
    throw error;
  }

  const pin = typeof data === 'string' ? data.trim() : '';

  if (!isValidAccessPin(pin)) {
    throw new Error('Código de acesso inválido retornado pelo servidor.');
  }

  return pin;
}

/** @deprecated Mensagens de PIN por WhatsApp foram removidas do fluxo de autenticação. */
export function buildAccessPinWhatsAppMessage(
  _pin: string,
  _screenPhone: string,
  _sendToUser: boolean
) {
  console.error(AUTH_CHANNEL_BLOCKED_MESSAGE, { fn: 'buildAccessPinWhatsAppMessage' });
  return AUTH_CHANNEL_BLOCKED_MESSAGE;
}

export type SendAccessPinViaWhatsAppResult =
  | {
      ok: true;
      pin: string;
      sendToUser: boolean;
      target: AccessPinDeliveryTarget;
      recipientLabel: string;
      whatsappOpened: boolean;
      message: string;
    }
  | { ok: false; reason: 'invalid_user_phone' | 'missing_manager_phone' | 'auth_channel_blocked' }
  | { ok: false; reason: 'profile_not_found'; managerNotified: boolean };

export async function updateProfileAccessPin(
  phone: string,
  currentPin: string,
  newPin: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isValidAccessPin(currentPin) || !isValidAccessPin(newPin)) {
    return { ok: false, message: 'A senha deve ter exatamente 4 dígitos numéricos.' };
  }

  if (currentPin.trim() === newPin.trim()) {
    return { ok: false, message: 'A nova senha deve ser diferente da atual.' };
  }

  const { error } = await supabase.rpc('update_profile_access_pin', {
    p_phone: phone,
    p_current_pin: currentPin.trim(),
    p_new_pin: newPin.trim(),
  });

  if (error) {
    console.error('update_profile_access_pin:', error);
    return {
      ok: false,
      message: error.message || 'Não foi possível atualizar a senha de acesso.',
    };
  }

  return { ok: true };
}

export type PreparedAccessPinDraft = {
  phoneDigits: string;
  pin: string;
  message: string;
  sendToUser: boolean;
  recipientDigits: string;
  recipientLabel: string;
};

export type PrepareAccessPinDraftResult =
  | { ok: true; draft: PreparedAccessPinDraft }
  | { ok: false; message: string };

/**
 * @deprecated PIN de autenticação não usa mais WhatsApp.
 * Use `dispatchAuthAccessPinEmail` em `@/lib/authNotificationService`.
 */
export async function prepareAccessPinDraft(
  _screenPhone: string
): Promise<PrepareAccessPinDraftResult> {
  console.error(AUTH_CHANNEL_BLOCKED_MESSAGE, { fn: 'prepareAccessPinDraft' });
  return {
    ok: false,
    message: `${AUTH_CHANNEL_BLOCKED_MESSAGE} ${AUTH_PIN_EMAIL_SQL_HINT}`,
  };
}

type SendAccessPinOptions = {
  /** Quando true, não abre wa.me (já aberto no gesto do toque, como aniversariantes). */
  skipOpenWhatsApp?: boolean;
  /** Evita nova RPC se o rascunho já foi preparado no toque. */
  prepared?: PreparedAccessPinDraft;
};

/**
 * @deprecated Bloqueado. Autenticação envia PIN apenas por e-mail
 * (`dispatchAuthAccessPinEmail` em `@/lib/authNotificationService`).
 */
export async function sendAccessPinViaWhatsApp(
  _screenPhone: string,
  _options?: SendAccessPinOptions
): Promise<SendAccessPinViaWhatsAppResult> {
  console.error(AUTH_CHANNEL_BLOCKED_MESSAGE, { fn: 'sendAccessPinViaWhatsApp' });
  return { ok: false, reason: 'auth_channel_blocked' };
}

/** Garante falha explícita se algum fluxo legado tentar WhatsApp para auth. */
export function assertAccessPinWhatsAppDisabled() {
  rejectAuthWhatsAppDelivery('accessPin.assertAccessPinWhatsAppDisabled');
}

/** @deprecated WhatsApp removido do fluxo de autenticação. */
export const buildAccessPinDeliveryAlertMessage = (
  _result?: Extract<SendAccessPinViaWhatsAppResult, { ok: true }>
) => AUTH_CHANNEL_BLOCKED_MESSAGE;
