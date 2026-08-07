import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform } from 'react-native';

const EXTERNAL_APP_SCHEME =
  /^(whatsapp|whatsapp-api|tel|mailto|sms|smsto|geo|maps|intent|market|tg|viber|fb|instagram|twitter|x|zoommtg|facetime):/i;

const FILE_EXT =
  /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z|png|jpe?g|gif|webp|mp3|mp4|mov)(\?|#|$)/i;

export function isExternalAppScheme(url: string): boolean {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return false;
  }
  return EXTERNAL_APP_SCHEME.test(trimmed);
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function isProbablyDownloadUrl(url: string): boolean {
  const trimmed = url?.trim() ?? '';
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return FILE_EXT.test(trimmed) || trimmed.startsWith('blob:');
  }
  try {
    const parsed = new URL(trimmed);
    if (FILE_EXT.test(parsed.pathname) || FILE_EXT.test(parsed.href)) {
      return true;
    }
    // Supabase Storage signed PDFs costuma usar path com .pdf
    if (parsed.pathname.toLowerCase().includes('/object/sign/') && parsed.pathname.toLowerCase().includes('.pdf')) {
      return true;
    }
  } catch {
    return FILE_EXT.test(trimmed);
  }
  return false;
}

export function isWhatsAppHttpUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'wa.me'
      || host === 'api.whatsapp.com'
      || host === 'web.whatsapp.com'
      || host.endsWith('.whatsapp.com')
    );
  } catch {
    return /wa\.me|whatsapp\.com/i.test(url);
  }
}

function guessFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').filter(Boolean).pop() || 'arquivo.pdf';
    const decoded = decodeURIComponent(base).replace(/[^\w.\-()+ ]+/g, '_');
    return decoded.includes('.') ? decoded : `${decoded}.pdf`;
  } catch {
    return 'arquivo.pdf';
  }
}

function guessMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

/** Abre app externo (WhatsApp, telefone…) ou browser do sistema. */
export async function openShellExternalUrl(url: string): Promise<boolean> {
  const target = url?.trim();
  if (!target) {
    return false;
  }

  try {
    if (isExternalAppScheme(target) || isWhatsAppHttpUrl(target)) {
      await Linking.openURL(target);
      return true;
    }

    if (isHttpUrl(target)) {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        await Linking.openURL(target);
        return true;
      }
      await WebBrowser.openBrowserAsync(target);
      return true;
    }

    await Linking.openURL(target);
    return true;
  } catch (error) {
    console.warn('openShellExternalUrl', target, error);
    try {
      if (isHttpUrl(target)) {
        await WebBrowser.openBrowserAsync(target);
        return true;
      }
    } catch (fallbackError) {
      console.warn('openShellExternalUrl fallback', fallbackError);
    }
    Alert.alert(
      'Não foi possível abrir',
      'Instale o aplicativo necessário (ex.: WhatsApp) ou tente novamente.'
    );
    return false;
  }
}

/** Baixa PDF/arquivo (URLs http/https) e abre o compartilhamento do SO para visualizar. */
export async function downloadAndOpenShellFile(url: string): Promise<boolean> {
  const target = url?.trim();
  if (!target) {
    return false;
  }

  if (target.startsWith('blob:') || target.startsWith('data:')) {
    // blob: só existe no WebView — tenta abrir via URL nativa se for data:, senão falha gentil.
    if (target.startsWith('data:')) {
      try {
        await Linking.openURL(target);
        return true;
      } catch {
        Alert.alert('Arquivo', 'Não foi possível abrir este arquivo no aplicativo.');
        return false;
      }
    }
    Alert.alert(
      'Arquivo',
      'Use o botão Abrir em nova aba novamente. Se persistir, abra o documento pelo site no Chrome.'
    );
    return false;
  }

  if (!isHttpUrl(target)) {
    return openShellExternalUrl(target);
  }

  try {
    // Primeiro: deixa o sistema (Chrome/Drive/Adobe) tentar abrir o link direto.
    const can = await Linking.canOpenURL(target);
    if (can) {
      await Linking.openURL(target);
      // Em muitos Androids o PDF abre no viewer externo; ainda assim baixamos se o SO só “Download” orfão.
    }
  } catch {
    // segue download local
  }

  try {
    const fileName = guessFileName(target);
    const dest = `${FileSystem.cacheDirectory ?? ''}shell-${Date.now()}-${fileName}`;
    const result = await FileSystem.downloadAsync(target, dest);
    if (result.status && result.status >= 400) {
      throw new Error(`HTTP ${result.status}`);
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        mimeType: guessMime(fileName),
        dialogTitle: 'Abrir arquivo',
        UTI: fileName.toLowerCase().endsWith('.pdf') ? 'com.adobe.pdf' : undefined,
      });
      return true;
    }

    await Linking.openURL(result.uri);
    return true;
  } catch (error) {
    console.warn('downloadAndOpenShellFile', error);
    try {
      await WebBrowser.openBrowserAsync(target);
      return true;
    } catch {
      Alert.alert('Download', 'Não foi possível baixar ou abrir o arquivo. Verifique a internet.');
      return false;
    }
  }
}

/**
 * Decide se a URL deve sair do WebView (apps externos / downloads).
 * Retorna false = cancelar navegação no WebView.
 */
export function shouldHandoffShellNavigation(url: string): {
  handoff: boolean;
  mode: 'external' | 'download' | 'none';
} {
  const target = url?.trim() ?? '';
  if (!target || target === 'about:blank') {
    return { handoff: false, mode: 'none' };
  }

  if (isExternalAppScheme(target)) {
    return { handoff: true, mode: 'external' };
  }

  if (isWhatsAppHttpUrl(target)) {
    return { handoff: true, mode: 'external' };
  }

  if (isProbablyDownloadUrl(target)) {
    return { handoff: true, mode: 'download' };
  }

  return { handoff: false, mode: 'none' };
}
