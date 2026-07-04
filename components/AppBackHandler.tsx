import { confirmExitApplication } from '@/lib/userSession';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Índice do Aplicativo (tabs). */
const isAppIndexScreen = (pathname: string, segments: string[]) => {
  if (segments[0] === '(tabs)') {
    return segments.length === 1 || segments[1] === 'index';
  }

  const normalized = normalizePathname(pathname);
  return normalized === '/(tabs)' || normalized === '/(tabs)/index';
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

/**
 * Botão nativo "voltar" (Android):
 * - em qualquer tela autenticada fora do Índice → vai ao Índice;
 * - no Índice (ou no login) → executa sair do aplicativo (com confirmação).
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
      if (isAppIndexScreen(pathname, segments) || isPublicEntryScreen(pathname, segments)) {
        void confirmExitApplication();
        return true;
      }

      router.replace('/(tabs)');
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
