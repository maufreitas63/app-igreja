import { getExitSessionUi, type ExitSessionUi } from '@/lib/sessionExitUi';
import { isWebPlatform } from '@/lib/pwaInstall';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const PWA_DISPLAY_MODE_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: fullscreen)',
  '(display-mode: minimal-ui)',
] as const;

/** Rótulo/hint do botão de saída — reavalia após montar (PWA vs aba do navegador). */
export function useExitSessionUi(): ExitSessionUi {
  const [ui, setUi] = useState<ExitSessionUi>(() => getExitSessionUi());

  useEffect(() => {
    setUi(getExitSessionUi());

    if (Platform.OS !== 'web' || !isWebPlatform() || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaLists = PWA_DISPLAY_MODE_QUERIES.map((query) => window.matchMedia(query));
    const refresh = () => setUi(getExitSessionUi());

    mediaLists.forEach((mediaList) => {
      if (typeof mediaList.addEventListener === 'function') {
        mediaList.addEventListener('change', refresh);
      } else {
        mediaList.addListener(refresh);
      }
    });

    return () => {
      mediaLists.forEach((mediaList) => {
        if (typeof mediaList.removeEventListener === 'function') {
          mediaList.removeEventListener('change', refresh);
        } else {
          mediaList.removeListener(refresh);
        }
      });
    };
  }, []);

  return ui;
}
