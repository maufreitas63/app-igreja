import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

export const normalizePhoneForWhatsApp = (value: string | null | undefined) => {
  const digits = (value ?? '').replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
};

/** URL no mesmo formato do card ANIVERSARIANTES (`handleOpenBirthdayWhatsapp`). */
export const buildWaMeUrl = (phone: string | null | undefined, message = '') => {
  const whatsappPhone = normalizePhoneForWhatsApp(phone);

  if (!whatsappPhone) {
    return null;
  }

  const base = `https://wa.me/${whatsappPhone}`;

  if (!message.trim()) {
    return base;
  }

  return `${base}?text=${encodeURIComponent(message)}`;
};

/**
 * Igual `handleOpenBirthdayWhatsapp` no dashboard — só `https://wa.me/{telefone}`, sem `?text=`.
 * Deve ser chamado no mesmo gesto do toque (antes de awaits), principalmente na web.
 */
export function openWhatsAppLikeBirthdays(phone: string | null | undefined) {
  const whatsappPhone = normalizePhoneForWhatsApp(phone);

  if (!whatsappPhone) {
    return null;
  }

  const url = `https://wa.me/${whatsappPhone}`;
  void Linking.openURL(url);
  return url;
}

/**
 * Abre wa.me com mensagem no mesmo gesto do toque (sem await antes).
 * Requer código já gerado (preparado ao completar o celular).
 */
export function openWhatsAppLikeBirthdaysWithText(
  phone: string | null | undefined,
  message: string
) {
  const url = buildWaMeUrl(phone, message);

  if (!url) {
    return null;
  }

  void Linking.openURL(url);
  return url;
}

/**
 * Abre wa.me com texto (pode falhar na web após awaits — prefira copiar + openWhatsAppLikeBirthdays).
 */
export async function openWhatsAppPhone(phone: string | null | undefined, message = '') {
  const url = buildWaMeUrl(phone, message);

  if (!url) {
    throw new Error('Telefone indisponível para WhatsApp.');
  }

  await Linking.openURL(url);
}
/** Card LISTA DE MEMBROS — abre `https://wa.me/{telefone}` sem mensagem pré-preenchida. */
export async function openMemberWhatsapp(phone: string | null | undefined) {
  const whatsappPhone = normalizePhoneForWhatsApp(phone);

  if (!whatsappPhone) {
    Alert.alert('Telefone indisponivel', 'Este membro nao possui telefone cadastrado no perfil.');
    return;
  }

  try {
    await Linking.openURL(`https://wa.me/${whatsappPhone}`);
  } catch (error) {
    console.error('Erro ao abrir WhatsApp:', error);
    Alert.alert('Erro', 'Nao foi possivel abrir o Zap deste membro.');
  }
}

/** Contato do responsável (card SALA(S)) — sem mensagem pré-preenchida. */
export const openRoomContactWhatsapp = async (phone: string | null) => {
  const whatsappPhone = normalizePhoneForWhatsApp(phone);

  if (!whatsappPhone) {
    Alert.alert(
      'Telefone indisponivel',
      'Nao foi encontrado telefone do responsavel para esta crianca.'
    );
    return;
  }

  try {
    await Linking.openURL(`https://wa.me/${whatsappPhone}`);
  } catch (error) {
    console.error('Erro ao abrir WhatsApp:', error);
    Alert.alert('Erro', 'Nao foi possivel abrir o Zap deste contato.');
  }
};

/** @deprecated Use `openWhatsAppPhone`. Mantido para compatibilidade com `accessPin`. */
export const openWhatsAppWithMessage = async (whatsappPhone: string, message: string) => {
  await openWhatsAppPhone(whatsappPhone, message);

  return { opened: true, channel: 'wa_me' as const };
};
