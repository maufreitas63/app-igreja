import {
  canOfferPwaInstallUi,
  getPwaInstallInstructions,
  isPwaInstalled,
  type BeforeInstallPromptEvent,
} from '@/lib/pwaInstall';
import { registerPwaServiceWorker } from '@/lib/pwaServiceWorker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type PwaInstallInstructions = {
  title: string;
  message: string;
};

export function usePwaInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(() => canOfferPwaInstallUi());
  const [instructions, setInstructions] = useState<PwaInstallInstructions | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setIsVisible(false);
      return;
    }

    registerPwaServiceWorker();

    const refreshVisibility = () => {
      setIsVisible(canOfferPwaInstallUi());
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      refreshVisibility();
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setIsVisible(false);
      setInstructions(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    refreshVisibility();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const dismissInstructions = useCallback(() => {
    setInstructions(null);
  }, []);

  const install = useCallback(async () => {
    if (!canOfferPwaInstallUi()) {
      return;
    }

    const deferredPrompt = deferredPromptRef.current;
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        deferredPromptRef.current = null;

        if (choice.outcome === 'accepted') {
          setIsVisible(false);
          setInstructions(null);
          return;
        }
      } catch (error) {
        console.error('Erro ao abrir prompt de instalação do PWA:', error);
      }
    }

    setInstructions(getPwaInstallInstructions());
  }, []);

  return {
    install,
    isVisible,
    instructions,
    dismissInstructions,
    isInstalled: isPwaInstalled(),
  };
}
