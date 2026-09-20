import { runAppBackInterceptor } from '@/lib/appBackIntercept';
import { isDrawerNavigationPending, installDrawerNavigationCapture } from '@/lib/drawerNavigationIntent';
import { ghostBlocksHomeBounce } from '@/lib/ghostNavigation';
import { subscribeGhostMode } from '@/lib/ghostMode';
import { confirmExitApplication } from '@/lib/userSession';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

const HOME_HREF = '/(tabs)';

/** Sessão tipicamente gravada no localStorage pelo AsyncStorage web. */
const webHasSessionHint = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) ?? '';
      if (
        key.includes('user_phone')
        || key.includes('user_profile_id')
        || key.includes('user_session_token')
      ) {
        const value = storage.getItem(key);
        if (value && value.trim() && value !== 'null') {
          return true;
        }
      }
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Índice autenticado (`(tabs)/index`).
 * No web o pathname costuma ser `/` (sem o grupo); segments trazem `(tabs)`.
 */
export const isAppIndexScreen = (pathname: string, segments: readonly string[]) => {
  const segmentList = segments.map(String);

  if (segmentList[0] === '(tabs)') {
    return segmentList.length === 1 || segmentList[1] === 'index';
  }

  const normalized = normalizePathname(pathname);

  if (normalized === '/(tabs)' || normalized === '/(tabs)/index') {
    return true;
  }

  if ((normalized === '/' || normalized === '/index') && webHasSessionHint()) {
    return true;
  }

  return false;
};

const isPublicLoginScreen = (pathname: string, segments: readonly string[]) => {
  if (segments[0] === '(tabs)') {
    return false;
  }

  if (webHasSessionHint()) {
    return false;
  }

  const normalized = normalizePathname(pathname);
  return (
    normalized === '/'
    || normalized === '/index'
    || normalized === '/sessao-encerrada'
  );
};

/**
 * Botão nativo "voltar" (Android) e voltar do navegador/PWA:
 * - no Índice → diálogo «Encerrar sessão»;
 * - fora do Índice → o Expo Router aplica o histórico (não forçar Início);
 * - Modo Ghost → nunca intercepta rumo ao Início.
 */
export function AppBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const [ghostActive, setGhostActive] = useState(() => ghostBlocksHomeBounce());

  const pathnameRef = useRef(pathname);
  const segmentsRef = useRef(segments);
  const exitDialogOpenRef = useRef(false);

  pathnameRef.current = pathname;
  segmentsRef.current = segments;

  useEffect(
    () =>
      subscribeGhostMode(() => {
        setGhostActive(ghostBlocksHomeBounce());
      }),
    []
  );

  const askExitSession = () => {
    if (exitDialogOpenRef.current) {
      return;
    }

    exitDialogOpenRef.current = true;

    const open = () => {
      void confirmExitApplication().finally(() => {
        exitDialogOpenRef.current = false;
      });
    };

    if (Platform.OS === 'web') {
      window.setTimeout(open, 0);
    } else {
      open();
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    const onPopState = () => {
      if (ghostBlocksHomeBounce() || isDrawerNavigationPending()) {
        return;
      }

      const currentPath = pathnameRef.current;
      const currentSegments = segmentsRef.current;
      const onHome = isAppIndexScreen(currentPath, currentSegments);

      if (runAppBackInterceptor()) {
        return;
      }

      if (onHome) {
        askExitSession();
        return;
      }

      if (isPublicLoginScreen(currentPath, currentSegments)) {
        return;
      }
    };

    installDrawerNavigationCapture();
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [router]);

  // Trap só no Índice, fora do Ghost. Empilhar pushState em toda rota
  // (ou no Ghost) faz o Expo Router / menu “voltar” e cair no Início.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    if (ghostActive || !isAppIndexScreen(pathname, segments)) {
      return undefined;
    }

    try {
      window.history.pushState({ appBackHandler: true }, '', window.location.href);
    } catch {
      // ignore
    }

    return undefined;
  }, [ghostActive, pathname, segments]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const onHardwareBackPress = () => {
      if (runAppBackInterceptor()) {
        return true;
      }

      if (isAppIndexScreen(pathnameRef.current, segmentsRef.current)) {
        askExitSession();
        return true;
      }

      if (isPublicLoginScreen(pathnameRef.current, segmentsRef.current)) {
        return true;
      }

      if (ghostBlocksHomeBounce()) {
        return false;
      }

      router.replace(HOME_HREF);
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );

    return () => {
      subscription.remove();
    };
  }, [router]);

  return null;
}
