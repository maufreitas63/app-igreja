import { getAppParameterValue } from '@/lib/appParameters';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { normalizePhoneForWhatsApp, openWhatsAppPhone } from '@/lib/whatsapp';

export const ACCESS_PIN_LENGTH = 4;

const normalizeDigits = (value: string) => value.replace(/\D/g, '');

/** Telefone enviado às RPCs do Supabase (sempre só dígitos, com DDD). */
export const normalizePhoneForAccessPinRpc = (phone: string) => normalizeDigits(phone);

export const isValidAccessPin = (pin: string) => /^\d{4}$/.test(pin.trim());

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

const formatAccessPinRpcError = (error: unknown) => {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Não foi possível gerar o código de acesso.';

  const normalized = message.toLowerCase();

  if (normalized.includes('não encontrado') || normalized.includes('nao encontrado')) {
    return (
      'Não foi possível criar o perfil para este celular. '
      + 'Execute no Supabase scripts/preparar-perfil-acesso-cadastro.sql (ou profiles-access-pin.sql).'
    );
  }

  if (
    normalized.includes('preparar o perfil')
    || normalized.includes('preparar o cadastro')
    || normalized.includes('perfil visitante')
  ) {
    return (
      'Não foi possível criar o perfil visitante. Execute no Supabase '
      + 'scripts/preparar-perfil-acesso-cadastro.sql (arquivo completo).'
    );
  }

  return message;
};

/** Define destino do WhatsApp conforme `psw_user` e `psw_mngr`. */
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

export function buildAccessPinWhatsAppMessage(pin: string, screenPhone: string, sendToUser: boolean) {
  const digits = normalizeDigits(screenPhone);

  if (sendToUser) {
    return `Olá! Seu código de acesso ao painel é: ${pin}. Use os 4 dígitos na tela de entrada.`;
  }

  return (
    `Código de acesso para cadastro — celular (${digits}): ${pin}. `
    + 'O membro deve entrar no app com esse código e concluir o cadastro inicial.'
  );
}

const isProfileNotFoundForAccessPinError = (error: unknown) => {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : String(error ?? '');

  const normalized = message.toLowerCase();

  return normalized.includes('não encontrado') || normalized.includes('nao encontrado');
};

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
  | { ok: false; reason: 'invalid_user_phone' | 'missing_manager_phone' }
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

/** Gera PIN + mensagem para o celular da tela (cria perfil mínimo no Supabase se necessário). */
export async function prepareAccessPinDraft(
  screenPhone: string
): Promise<PrepareAccessPinDraftResult> {
  const screenDigits = normalizeDigits(screenPhone);

  if (screenDigits.length < 10) {
    return { ok: false, message: 'Informe um celular válido com DDD.' };
  }

  try {
    const settings = await loadAccessPinDeliverySettings();
    const recipientDigits = getAccessPinWhatsappRecipientDigits(settings, screenDigits);

    if (!recipientDigits) {
      return {
        ok: false,
        message: settings.sendToUser
          ? 'Celular inválido na tela de entrada.'
          : 'Cadastre psw_mngr em app_parameters (somente dígitos, ex.: 19996166161).',
      };
    }

    const pin = await regenerateProfileAccessPin(screenPhone);
    const message = buildAccessPinWhatsAppMessage(pin, screenPhone, settings.sendToUser);

    return {
      ok: true,
      draft: {
        phoneDigits: screenDigits,
        pin,
        message,
        sendToUser: settings.sendToUser,
        recipientDigits,
        recipientLabel: settings.recipientLabel,
      },
    };
  } catch (error) {
    console.error('Erro ao preparar código de acesso:', error);
    return { ok: false, message: formatAccessPinRpcError(error) };
  }
}

type SendAccessPinOptions = {
  /** Quando true, não abre wa.me (já aberto no gesto do toque, como aniversariantes). */
  skipOpenWhatsApp?: boolean;
  /** Evita nova RPC se o rascunho já foi preparado no toque. */
  prepared?: PreparedAccessPinDraft;
};

export async function sendAccessPinViaWhatsApp(
  screenPhone: string,
  options?: SendAccessPinOptions
): Promise<SendAccessPinViaWhatsAppResult> {
  const delivery = await resolveAccessPinDelivery(screenPhone);

  if (delivery.sendToUser) {
    const userDigits = normalizeDigits(screenPhone);

    if (userDigits.length < 10) {
      return { ok: false, reason: 'invalid_user_phone' };
    }
  } else if (!delivery.recipientDigits) {
    return { ok: false, reason: 'missing_manager_phone' };
  }

  const whatsappPhone = normalizePhoneForWhatsApp(delivery.recipientDigits);

  if (!whatsappPhone) {
    return {
      ok: false,
      reason: delivery.sendToUser ? 'invalid_user_phone' : 'missing_manager_phone',
    };
  }

  let pin: string;
  let message: string;

  if (
    options?.prepared
    && options.prepared.phoneDigits === normalizeDigits(screenPhone)
  ) {
    pin = options.prepared.pin;
    message = options.prepared.message;
  } else {
    try {
      pin = await regenerateProfileAccessPin(screenPhone);
    } catch (error) {
      if (isProfileNotFoundForAccessPinError(error)) {
        return {
          ok: false,
          reason: 'profile_not_found',
          managerNotified: false,
        };
      }

      throw error;
    }

    message = buildAccessPinWhatsAppMessage(pin, screenPhone, delivery.sendToUser);
  }

  let whatsappOpened = options?.skipOpenWhatsApp ?? false;

  if (!options?.skipOpenWhatsApp) {
    try {
      await openWhatsAppPhone(whatsappPhone, message);
      whatsappOpened = true;
    } catch (error) {
      console.error('Erro ao abrir WhatsApp (wa.me):', error);
    }
  }

  return {
    ok: true,
    pin,
    message,
    sendToUser: delivery.sendToUser,
    target: delivery.target,
    recipientLabel: delivery.recipientLabel,
    whatsappOpened,
  };
}

export const buildAccessPinDeliveryAlertMessage = (
  result: Extract<SendAccessPinViaWhatsAppResult, { ok: true }>
) => {
  const pinLine = `Código temporário: ${result.pin}`;
  const sendHint =
    'A mensagem com o código deve aparecer no WhatsApp. Confira e toque em Enviar. O texto também foi copiado na área de transferência.';
  const afterPinHint = result.sendToUser
    ? 'Digite os 4 dígitos na tela de entrada e altere a senha em Dados Cadastrais.'
    : 'Repasse o código ao membro para ele entrar no app e concluir o cadastro inicial.';

  return (
    `${pinLine}\n\n`
    + (result.whatsappOpened
      ? (result.sendToUser
          ? 'O WhatsApp foi aberto (como em Aniversariantes). '
          : `O WhatsApp foi aberto para ${result.recipientLabel}. `)
      : 'Abra o WhatsApp manualmente se a conversa não tiver aparecido. ')
    + `${sendHint}\n\n${afterPinHint}`
  );
};
