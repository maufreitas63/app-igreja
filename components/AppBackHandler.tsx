import { confirmExitApplication } from '@/lib/userSession';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
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

  // Home autenticada reportada como `/` (comum no Expo Router web).
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
 * - fora do Índice → vai ao Índice;
 * - no Índice → diálogo «Encerrar sessão».
 */
export function AppBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  const pathnameRef = useRef(pathname);
  const segmentsRef = useRef(segments);
  const exitDialogOpenRef = useRef(false);

  pathnameRef.current = pathname;
  segmentsRef.current = segments;

  const askExitSession = () => {
    if (exitDialogOpenRef.current) {
      return;
    }

    exitDialogOpenRef.current = true;

    // Deixa o popstate/navegação assentar antes do Modal (evita o host sumir no re-render).
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

  // Listener web montado uma vez — refs carregam a rota atual.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    const pushTrap = () => {
      try {
        window.history.pushState({ appBackHandler: true }, '', window.location.href);
      } catch {
        // ignore
      }
    };

    const onPopState = () => {
      const currentPath = pathnameRef.current;
      const currentSegments = segmentsRef.current;
      const onHome = isAppIndexScreen(currentPath, currentSegments);

      // Reempilha imediatamente para o próximo "voltar" continuar interceptável.
      pushTrap();

      if (onHome) {
        try {
          router.replace(HOME_HREF);
        } catch {
          // ignore
        }
        askExitSession();
        return;
      }

      if (isPublicLoginScreen(currentPath, currentSegments)) {
        return;
      }

      router.replace(HOME_HREF);
    };

    pushTrap();
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listener único; estado via refs
  }, [router]);

  // Em cada troca de rota autenticada, garante um trap fresco (expo-router mexe no history).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (isPublicLoginScreen(pathname, segments)) {
      return;
    }

    try {
      window.history.pushState({ appBackHandler: true }, '', window.location.href);
    } catch {
      // ignore
    }
  }, [pathname, segments]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const onHardwareBackPress = () => {
      if (isAppIndexScreen(pathnameRef.current, segmentsRef.current)) {
        askExitSession();
        return true;
      }

      if (isPublicLoginScreen(pathnameRef.current, segmentsRef.current)) {
        return true;
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
