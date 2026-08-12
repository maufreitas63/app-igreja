import { confirmExitApplication } from '@/lib/userSession';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/**
 * Índice do Aplicativo (tela inicial autenticada).
 * No Expo Router o pathname do grupo `(tabs)` costuma ser `/` ou `/(tabs)` —
 * os segments distinguem do login em `app/index.tsx`.
 */
const isAppIndexScreen = (pathname: string, segments: string[]) => {
  if (segments[0] === '(tabs)') {
    return segments.length === 1 || segments[1] === 'index';
  }

  const normalized = normalizePathname(pathname);
  return (
    normalized === '/(tabs)'
    || normalized === '/(tabs)/index'
  );
};

/** Login ou tela pós-saída (sem Índice autenticado). */
const isPublicEntryScreen = (pathname: string, segments: string[]) => {
  if (segments[0] === '(tabs)') {
    return false;
  }

  const normalized = normalizePathname(pathname);
  return (
    normalized === '/'
    || normalized === '/index'
    || normalized === '/sessao-encerrada'
  );
};

const HOME_HREF = '/(tabs)';

/**
 * Botão nativo "voltar" (Android) e voltar do navegador/PWA:
 * - em qualquer tela autenticada fora do Índice → vai ao Índice (tela inicial);
 * - no Índice → diálogo «Encerrar sessão» (Cancelar / Sair).
 *
 * Na web o BackHandler da RN não existe; usamos `popstate` + sentinel no history.
 */
export function AppBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const isHomeRef = useRef(false);
  const exitDialogOpenRef = useRef(false);

  isHomeRef.current = isAppIndexScreen(pathname, segments);

  useEffect(() => {
    const askExitSession = () => {
      if (exitDialogOpenRef.current) {
        return;
      }

      exitDialogOpenRef.current = true;
      void confirmExitApplication().finally(() => {
        exitDialogOpenRef.current = false;
      });
    };

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        return undefined;
      }

      const onPopState = () => {
        if (isHomeRef.current) {
          // Mantém a URL na tela inicial e abre o diálogo Encerrar sessão.
          window.history.pushState({ appBackHandler: true }, '', window.location.href);
          askExitSession();
          return;
        }

        if (isPublicEntryScreen(pathname, segments)) {
          window.history.pushState({ appBackHandler: true }, '', window.location.href);
          return;
        }

        router.replace(HOME_HREF);
      };

      // Sentinel: o próximo "voltar" dispara popstate aqui.
      window.history.pushState({ appBackHandler: true }, '', window.location.href);
      window.addEventListener('popstate', onPopState);

      return () => {
        window.removeEventListener('popstate', onPopState);
      };
    }

    const onHardwareBackPress = () => {
      if (isHomeRef.current) {
        askExitSession();
        return true;
      }

      if (isPublicEntryScreen(pathname, segments)) {
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
  }, [pathname, router, segments]);

  return null;
}
