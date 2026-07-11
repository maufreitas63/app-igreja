import { reportLayoutInconsistenciesIfNeeded } from '@/lib/layoutInconsistencyDetector';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

const SCAN_INTERVAL_MS = 5_000;

/**
 * Observa overflow/sobreposição na web para super administrador:
 * copia nomes dos elementos e vibra quando encontra inconsistência.
 */
export function LayoutInconsistencyWatcher() {
  const pathname = usePathname();
  const enabledRef = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const runScan = () => {
      if (cancelled || !enabledRef.current) {
        return;
      }
      void reportLayoutInconsistenciesIfNeeded({ pathname: pathnameRef.current });
    };

    const scheduleScan = (delayMs = 350) => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(runScan, delayMs);
    };

    const startWatching = () => {
      if (intervalId) {
        return;
      }

      intervalId = setInterval(runScan, SCAN_INTERVAL_MS);
      scheduleScan(600);

      if (typeof window !== 'undefined') {
        window.addEventListener('resize', onResize);
      }

      if (typeof MutationObserver !== 'undefined' && document.body) {
        observer = new MutationObserver(() => scheduleScan(800));
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
      }
    };

    const stopWatching = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (resizeTimer) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onResize);
      }
      observer?.disconnect();
      observer = null;
    };

    const onResize = () => scheduleScan(400);

    void checkSessionIsSuperAdmin()
      .then((isSuperAdmin) => {
        if (cancelled) {
          return;
        }
        enabledRef.current = isSuperAdmin;
        if (isSuperAdmin) {
          startWatching();
        }
      })
      .catch(() => {
        enabledRef.current = false;
      });

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && enabledRef.current) {
        scheduleScan(200);
      }
    });

    return () => {
      cancelled = true;
      stopWatching();
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabledRef.current) {
      return;
    }
    void reportLayoutInconsistenciesIfNeeded({ pathname });
  }, [pathname]);

  return null;
}
