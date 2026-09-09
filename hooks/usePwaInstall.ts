import {
  canOfferPwaInstallUi,
  dismissPwaInstallBanner,
  getDeferredInstallPrompt,
  getPwaInstallInstructions,
  getPwaInstallVariant,
  isPwaInstallBannerDismissed,
  isPwaInstalled,
  subscribeDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
  type PwaInstallVariant,
} from '@/lib/pwaInstall';
import { getEntityPrefix } from '@/lib/entityPrefix';
import { registerPwaServiceWorker } from '@/lib/pwaServiceWorker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type PwaInstallInstructions = {
  title: string;
  message: string;
};

const SHOW_DELAY_MS = 900;

export function usePwaInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(getDeferredInstallPrompt());
  const [isVisible, setIsVisible] = useState(false);
  const [instructions, setInstructions] = useState<PwaInstallInstructions | null>(null);
  const [variant, setVariant] = useState<PwaInstallVariant | null>(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(() => Boolean(getDeferredInstallPrompt()));

  const refreshVisibility = useCallback(() => {
    const nextVariant = getPwaInstallVariant();
    setVariant(nextVariant);
    setHasNativePrompt(Boolean(deferredPromptRef.current));
    setIsVisible(Boolean(nextVariant) && !isPwaInstallBannerDismissed());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setIsVisible(false);
      setVariant(null);
      return;
    }

    registerPwaServiceWorker();

    const unsubscribe = subscribeDeferredInstallPrompt((prompt) => {
      deferredPromptRef.current = prompt;
      setHasNativePrompt(Boolean(prompt));

      if (!prompt && isPwaInstalled()) {
        setIsVisible(false);
        setInstructions(null);
        setVariant(null);
      }
    });

    const showTimer = window.setTimeout(() => {
      refreshVisibility();
    }, SHOW_DELAY_MS);

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setHasNativePrompt(false);
      setIsVisible(false);
      setInstructions(null);
      setVariant(null);
    };

    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      unsubscribe();
      window.clearTimeout(showTimer);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [refreshVisibility]);

  const dismissInstructions = useCallback(() => {
    setInstructions(null);
  }, []);

  const dismissBanner = useCallback(() => {
    dismissPwaInstallBanner();
    setInstructions(null);
    setIsVisible(false);
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
        setHasNativePrompt(false);

        if (choice.outcome === 'accepted') {
          setIsVisible(false);
          setInstructions(null);
          return;
        }
      } catch (error) {
        console.error('Erro ao abrir prompt de instalação do PWA:', error);
      }
    }

    const prefix = await getEntityPrefix();
    setInstructions(getPwaInstallInstructions(prefix));
  }, []);

  return {
    install,
    isVisible,
    instructions,
    dismissInstructions,
    dismissBanner,
    variant,
    hasNativePrompt,
    isInstalled: isPwaInstalled(),
  };
}
