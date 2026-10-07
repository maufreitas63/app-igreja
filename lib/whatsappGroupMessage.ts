import { openWhatsAppShellUrl } from '@/lib/pwaShellNavigation';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';

export type SessionWhatsappGroup = {
  success: boolean;
  message?: string;
  whatsappGroupId: string | null;
};

export async function fetchSessionWhatsappGroup(): Promise<SessionWhatsappGroup> {
  const { data, error } = await supabase.rpc('get_session_whatsapp_group');

  if (error) {
    return {
      success: false,
      message: error.message?.trim() || 'Não foi possível ler o grupo de WhatsApp.',
      whatsappGroupId: null,
    };
  }

  const result = (data ?? {}) as {
    success?: boolean;
    message?: string;
    whatsapp_group_id?: string | null;
  };

  return {
    success: result.success === true,
    message: result.message,
    whatsappGroupId:
      typeof result.whatsapp_group_id === 'string' && result.whatsapp_group_id.trim()
        ? result.whatsapp_group_id.trim()
        : null,
  };
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Convite, link ou telefone gravados na instância → URL que o WhatsApp abre. */
export function buildWhatsappGroupUrl(groupId: string, message: string): {
  url: string;
  pasteInGroup: boolean;
} {
  const raw = groupId.trim();
  const text = message.trim();
  const encoded = encodeURIComponent(text);
  const digits = phoneDigits(raw);
  const looksLikePhone =
    digits.length >= 10
    && digits.length <= 15
    && !raw.includes('@')
    && !/chat\.whatsapp\.com|wa\.me/i.test(raw);

  if (looksLikePhone) {
    const withCountry = digits.length <= 11 ? `55${digits}` : digits;
    return {
      url: `https://wa.me/${withCountry}?text=${encoded}`,
      pasteInGroup: false,
    };
  }

  if (/^https?:\/\//i.test(raw)) {
    return { url: raw, pasteInGroup: true };
  }

  return {
    url: `https://chat.whatsapp.com/${raw.replace(/^\/+/, '')}`,
    pasteInGroup: true,
  };
}

async function copyMessage(message: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return true;
    }
  } catch {
    // O navegador pode bloquear a área de transferência fora de um gesto.
  }

  try {
    await Clipboard.setStringAsync(message);
    return true;
  } catch {
    return false;
  }
}

export async function sendWhatsappGroupMessage(
  groupId: string,
  message: string
): Promise<{ opened: boolean; pasteInGroup: boolean; copied: boolean }> {
  const target = buildWhatsappGroupUrl(groupId, message);
  // Cópia e abertura no mesmo gesto do clique — um await antes do window.open perde o pop-up.
  const copyPromise = target.pasteInGroup ? copyMessage(message.trim()) : Promise.resolve(false);
  const opened = openGroupUrlNow(target.url);
  const copied = await copyPromise;
  return { opened, pasteInGroup: target.pasteInGroup, copied };
}

/** Nova aba, no mesmo gesto do clique, para o aplicativo continuar aberto. */
function openGroupUrlNow(url: string): boolean {
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (popup) {
      return true;
    }
  }

  void openWhatsAppShellUrl(url);
  return false;
}
