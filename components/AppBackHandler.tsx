import { confirmExitApplication } from '@/lib/userSession';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Tela inicial autenticada (Índice) ou login público. */
const isApplicationHomeScreen = (pathname: string, segments: string[]) => {
  const normalized = normalizePathname(pathname);

  if (normalized === '/' || normalized === '/index' || normalized === '/sessao-encerrada') {
    return true;
  }

  if (segments[0] === '(tabs)') {
    return segments.length === 1 || segments[1] === 'index';
  }

  return false;
};

/**
 * Botão nativo "voltar" (Android):
 * - em telas internas, volta na pilha do app;
 * - na tela inicial (Índice ou login), pergunta se deseja sair.
 */
export function AppBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const onHardwareBackPress = () => {
      const atHome = isApplicationHomeScreen(pathname, segments);

      if (atHome) {
        void confirmExitApplication();
        return true;
      }

      if (router.canGoBack()) {
        router.back();
        return true;
      }

      void confirmExitApplication();
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
