import { DEFAULT_ENTITY_PREFIX } from '@/lib/entityPrefix';
import { Platform } from 'react-native';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type PwaInstallVariant = 'android' | 'ios' | 'ios-other-browser';

export const PWA_INSTALL_DISMISS_KEY = 'pwaInstallBannerDismissedAt.v1';
export const PWA_INSTALL_DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type PromptListener = (prompt: BeforeInstallPromptEvent | null) => void;

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<PromptListener>();
let earlyCaptureBound = false;

export const isWebPlatform = () => Platform.OS === 'web';

export const isIosWeb = () => {
  if (!isWebPlatform() || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent ?? '';
  const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpadOsDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleDevice || isIpadOsDesktop;
};

export const isAndroidWeb = () => {
  if (!isWebPlatform() || typeof navigator === 'undefined') {
    return false;
  }

  return /Android/i.test(navigator.userAgent ?? '');
};

export const isMobileWeb = () => isIosWeb() || isAndroidWeb();

/** Safari no iPhone/iPad (único caminho para “Adicionar à Tela Inicial”). */
export const isIosSafari = () => {
  if (!isIosWeb() || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent ?? '';
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Brave/i.test(ua);
  return /Safari/i.test(ua) && !isOtherIosBrowser;
};

/** WebView do APK/TWA — o app já está embutido; não oferecer instalação. */
export const isEmbeddedBrowserShell = () => {
  if (!isWebPlatform() || typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if ('ReactNativeWebView' in window) {
    return true;
  }

  const ua = navigator.userAgent ?? '';
  return /; wv\)/i.test(ua);
};

/** Detecta se o PWA já está aberto como app instalado (atalho na tela inicial). */
export const isPwaInstalled = () => {
  if (!isWebPlatform() || typeof window === 'undefined') {
    return false;
  }

  const displayModes = ['standalone', 'fullscreen', 'minimal-ui'] as const;
  const standaloneQuery = displayModes.some(
    (mode) =>
      typeof window.matchMedia === 'function'
      && window.matchMedia(`(display-mode: ${mode})`).matches
  );

  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone
  );

  const androidTwa =
    typeof document !== 'undefined'
    && document.referrer.startsWith('android-app://');

  return standaloneQuery || iosStandalone || androidTwa;
};

export const canOfferPwaInstallUi = () =>
  isWebPlatform()
  && isMobileWeb()
  && !isPwaInstalled()
  && !isEmbeddedBrowserShell();

export const getPwaInstallVariant = (): PwaInstallVariant | null => {
  if (!canOfferPwaInstallUi()) {
    return null;
  }

  if (isIosWeb()) {
    return isIosSafari() ? 'ios' : 'ios-other-browser';
  }

  if (isAndroidWeb()) {
    return 'android';
  }

  return null;
};

export const getDeferredInstallPrompt = () => deferredInstallPrompt;

export const subscribeDeferredInstallPrompt = (listener: PromptListener) => {
  bindEarlyInstallPromptCapture();
  promptListeners.add(listener);
  listener(deferredInstallPrompt);

  return () => {
    promptListeners.delete(listener);
  };
};

const notifyPromptListeners = () => {
  promptListeners.forEach((listener) => listener(deferredInstallPrompt));
};

export const bindEarlyInstallPromptCapture = () => {
  if (earlyCaptureBound || typeof window === 'undefined' || !isWebPlatform()) {
    return;
  }

  earlyCaptureBound = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyPromptListeners();
  });
};

bindEarlyInstallPromptCapture();

const readDismissedAtMs = (): number | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY)?.trim();
    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

export const isPwaInstallBannerDismissed = () => {
  const dismissedAt = readDismissedAtMs();
  if (!dismissedAt) {
    return false;
  }

  return Date.now() - dismissedAt < PWA_INSTALL_DISMISS_TTL_MS;
};

export const dismissPwaInstallBanner = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    // storage bloqueado / privado
  }
};

export const getPwaInstallInstructions = (entityPrefix = DEFAULT_ENTITY_PREFIX) => {
  const brand = entityPrefix?.trim() || 'igreja';

  if (isIosWeb()) {
    if (!isIosSafari()) {
      return {
        title: 'Adicionar à Tela de Início',
        message:
          'No iPhone e iPad, a instalação só funciona no Safari. Abra este site no Safari, '
          + 'toque em Compartilhar e escolha "Adicionar à Tela de Início".',
      };
    }

    return {
      title: 'Adicionar à Tela de Início',
      message:
        'No Safari, toque em Compartilhar (ícone com seta para cima), role o menu e escolha '
        + `"Adicionar à Tela de Início". O atalho usará o logotipo da ${brand}.`,
    };
  }

  if (isAndroidWeb()) {
    return {
      title: 'Adicionar à Tela de Início',
      message:
        'No menu do Chrome (⋮), toque em "Instalar app", "Adicionar à tela inicial" '
        + `ou "Instalar aplicativo" para criar o atalho com o logotipo da ${brand}.`,
    };
  }

  return {
    title: 'Instalar o app',
    message:
      'Use a opção "Instalar aplicativo" ou "Adicionar à tela inicial" no menu do navegador '
      + `para criar um atalho com o logotipo da ${brand}.`,
  };
};
