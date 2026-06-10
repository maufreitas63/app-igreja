import {
  canOfferPwaInstallUi,
  getPwaInstallInstructions,
  isIosWeb,
  isPwaInstalled,
  type BeforeInstallPromptEvent,
} from '@/lib/pwaInstall';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

export function usePwaInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(() => canOfferPwaInstallUi());
  const [hasNativePrompt, setHasNativePrompt] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setIsVisible(false);
      return;
    }

    const refreshVisibility = () => {
      setIsVisible(canOfferPwaInstallUi());
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setHasNativePrompt(true);
      refreshVisibility();
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setHasNativePrompt(false);
      setIsVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    refreshVisibility();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
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
        }
      } catch (error) {
        console.error('Erro ao abrir prompt de instalação do PWA:', error);
        const instructions = getPwaInstallInstructions();
        Alert.alert(instructions.title, instructions.message);
      }
      return;
    }

    const instructions = getPwaInstallInstructions();
    Alert.alert(instructions.title, instructions.message);
  }, []);

  return {
    install,
    isVisible,
    hasNativePrompt: hasNativePrompt || isIosWeb(),
    isInstalled: isPwaInstalled(),
  };
}
