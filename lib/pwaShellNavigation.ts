import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform } from 'react-native';

const EXTERNAL_APP_SCHEME =
  /^(whatsapp|whatsapp-api|tel|mailto|sms|smsto|geo|maps|intent|market|tg|viber|fb|instagram|twitter|x|zoommtg|facetime):/i;

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

export function isPdfUrl(url: string): boolean {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:application/pdf')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.toLowerCase();
    if (path.endsWith('.pdf') || path.includes('.pdf')) {
      return true;
    }
    if (path.includes('/object/sign/') || path.includes('/object/public/')) {
      // signed storage: frequentemente PDF nas atas; Content-Type tratado pelo viewer
      return /\.pdf/i.test(path) || parsed.searchParams.get('download') === null && /\.pdf/i.test(trimmed);
    }
  } catch {
    return /\.pdf(\?|#|$)/i.test(trimmed);
  }
  return /\.pdf(\?|#|$)/i.test(trimmed);
}

/** Outros arquivos (não-PDF) que o shell baixa e compartilha. */
export function isOtherDownloadUrl(url: string): boolean {
  const trimmed = url?.trim() ?? '';
  if (!trimmed || isPdfUrl(trimmed)) {
    return false;
  }
  return /\.(docx?|xlsx?|pptx?|zip|rar|7z|csv)(\?|#|$)/i.test(trimmed);
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

function extractWhatsAppPhoneAndText(url: string): { phone: string; text: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'whatsapp:' || parsed.protocol === 'whatsapp-api:') {
      const phone =
        parsed.searchParams.get('phone')
        || parsed.pathname.replace(/^\/*send\/?/, '').replace(/\D/g, '')
        || '';
      return { phone: phone.replace(/\D/g, ''), text: parsed.searchParams.get('text') || '' };
    }
    if (parsed.hostname === 'wa.me' || parsed.hostname.endsWith('.wa.me')) {
      const phone = parsed.pathname.replace(/^\//, '').split(/[/?#]/)[0] || '';
      return {
        phone: phone.replace(/\D/g, ''),
        text: parsed.searchParams.get('text') || '',
      };
    }
    if (parsed.hostname.includes('whatsapp.com')) {
      return {
        phone: (parsed.searchParams.get('phone') || '').replace(/\D/g, ''),
        text: parsed.searchParams.get('text') || '',
      };
    }
  } catch {
    // ignore
  }
  return { phone: '', text: '' };
}

/** Candidatos de URL para abrir o app WhatsApp no Android/iOS. */
export function buildWhatsAppOpenCandidates(url: string): string[] {
  const target = url.trim();
  const { phone, text } = extractWhatsAppPhoneAndText(target);
  const list: string[] = [];
  const textQ = text ? `&text=${encodeURIComponent(text)}` : '';

  if (phone) {
    list.push(`whatsapp://send?phone=${phone}${textQ}`);
    if (Platform.OS === 'android') {
      list.push(
        `intent://send?phone=${phone}${textQ}#Intent;scheme=whatsapp;package=com.whatsapp;end`
      );
      list.push(
        `intent://send?phone=${phone}${textQ}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`
      );
    }
  }

  if (/^whatsapp:/i.test(target)) {
    list.push(target);
  }

  if (isWhatsAppHttpUrl(target) || isHttpUrl(target)) {
    list.push(target);
  }

  // wa.me como último fallback se veio só whatsapp://
  if (phone && !list.includes(`https://wa.me/${phone}`)) {
    list.push(text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`);
  }

  return [...new Set(list.filter(Boolean))];
}

export async function openWhatsAppShellUrl(url: string): Promise<boolean> {
  const candidates = buildWhatsAppOpenCandidates(url);

  for (const candidate of candidates) {
    try {
      await Linking.openURL(candidate);
      return true;
    } catch (error) {
      console.warn('openWhatsAppShellUrl candidate failed', candidate, error);
    }
  }

  Alert.alert(
    'WhatsApp',
    'Não foi possível abrir o WhatsApp. Confira se o app está instalado e tente de novo.'
  );
  return false;
}

/** Abre app externo (telefone, WhatsApp, etc.) ou browser do sistema. */
export async function openShellExternalUrl(url: string): Promise<boolean> {
  const target = url?.trim();
  if (!target) {
    return false;
  }

  if (isWhatsAppHttpUrl(target) || /^whatsapp:/i.test(target) || target.includes('wa.me')) {
    return openWhatsAppShellUrl(target);
  }

  try {
    if (isExternalAppScheme(target)) {
      await Linking.openURL(target);
      return true;
    }

    if (isHttpUrl(target)) {
      await Linking.openURL(target);
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
      'Instale o aplicativo necessário ou tente novamente.'
    );
    return false;
  }
}

export function shouldHandoffShellNavigation(url: string): {
  handoff: boolean;
  mode: 'external' | 'pdf' | 'download' | 'none';
} {
  const target = url?.trim() ?? '';
  if (!target || target === 'about:blank') {
    return { handoff: false, mode: 'none' };
  }

  // Visualizador PDF.js da própria PWA — fica no WebView.
  if (/\/pdfjs\/viewer\.html/i.test(target) || target.includes('pdfjs/viewer.html')) {
    return { handoff: false, mode: 'none' };
  }

  if (isExternalAppScheme(target) || isWhatsAppHttpUrl(target)) {
    return { handoff: true, mode: 'external' };
  }

  // PDF: painel nativo embutido (não share sheet).
  if (isPdfUrl(target)) {
    return { handoff: true, mode: 'pdf' };
  }

  if (isOtherDownloadUrl(target)) {
    return { handoff: true, mode: 'download' };
  }

  return { handoff: false, mode: 'none' };
}

export function buildShellPdfViewerUri(pdfUrl: string, entryBaseUrl: string): string {
  const base = entryBaseUrl.replace(/\/+$/, '');
  return `${base}/pdfjs/viewer.html?file=${encodeURIComponent(pdfUrl)}`;
}

/** Baixa uma imagem HTTP e abre o compartilhamento nativo (WhatsApp, etc.). */
export async function downloadAndShareImageFile(url: string): Promise<boolean> {
  const target = url?.trim();
  if (!target || !isHttpUrl(target)) {
    return false;
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    const dest = `${FileSystem.cacheDirectory ?? ''}resumo-financeiro-${Date.now()}.jpg`;
    const result = await FileSystem.downloadAsync(target, dest);
    if (result.status && result.status >= 400) {
      throw new Error(`HTTP ${result.status}`);
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Enviar resumo financeiro pelo WhatsApp',
        UTI: 'public.jpeg',
      });
      return true;
    }
    await Linking.openURL(result.uri);
    return true;
  } catch (error) {
    console.warn('downloadAndShareImageFile', error);
    return false;
  }
}

/** Baixa arquivo não-PDF e abre o share sheet do SO. */
export async function downloadAndOpenShellFile(url: string): Promise<boolean> {
  const target = url?.trim();
  if (!target || !isHttpUrl(target)) {
    return openShellExternalUrl(target || '');
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    const fileName = (() => {
      try {
        const path = new URL(target).pathname;
        const base = path.split('/').filter(Boolean).pop() || 'arquivo.bin';
        return decodeURIComponent(base).replace(/[^\w.\-()+ ]+/g, '_') || 'arquivo.bin';
      } catch {
        return 'arquivo.bin';
      }
    })();
    const dest = `${FileSystem.cacheDirectory ?? ''}shell-${Date.now()}-${fileName}`;
    const result = await FileSystem.downloadAsync(target, dest);
    if (result.status && result.status >= 400) {
      throw new Error(`HTTP ${result.status}`);
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Abrir arquivo',
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
      Alert.alert('Download', 'Não foi possível baixar o arquivo.');
      return false;
    }
  }
}
