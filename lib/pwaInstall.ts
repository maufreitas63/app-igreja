import { Platform } from 'react-native';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

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

/** Detecta se o PWA já está aberto como app instalado (atalho na tela inicial). */
export const isPwaInstalled = () => {
  if (!isWebPlatform() || typeof window === 'undefined') {
    return false;
  }

  const standaloneQuery =
    typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;

  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone
  );

  return standaloneQuery || iosStandalone;
};

export const canOfferPwaInstallUi = () => isWebPlatform() && !isPwaInstalled();

export const getPwaInstallInstructions = () => {
  if (isIosWeb()) {
    return {
      title: 'Adicionar à Tela de Início',
      message:
        'No Safari, toque em Compartilhar (ícone com seta para cima), role o menu e escolha '
        + '"Adicionar à Tela de Início". O atalho usará o logotipo da IBN.',
    };
  }

  if (isAndroidWeb()) {
    return {
      title: 'Adicionar à Tela de Início',
      message:
        'No menu do Chrome (⋮), toque em "Instalar app", "Adicionar à tela inicial" '
        + 'ou "Instalar aplicativo" para criar o atalho com o logotipo da IBN.',
    };
  }

  return {
    title: 'Instalar o app',
    message:
      'Use a opção "Instalar aplicativo" ou "Adicionar à tela inicial" no menu do navegador '
      + 'para criar um atalho com o logotipo da IBN.',
  };
};
