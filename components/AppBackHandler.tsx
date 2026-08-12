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

const HOME_HREF = '/(tabs)';

/**
 * Botão nativo "voltar" (Android) e voltar do navegador/PWA:
 * - em qualquer tela autenticada fora do Índice → vai ao Índice (tela inicial);
 * - no Índice (ou no login) → executa sair do aplicativo (com confirmação).
 *
 * Na web o BackHandler da RN não existe; usamos `popstate` + sentinel no history
 * para não cair na rota anterior da pilha (ex.: Perfil → Financeiro → voltar).
 */
export function AppBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    const onIndexOrPublic =
      isAppIndexScreen(pathname, segments) || isPublicEntryScreen(pathname, segments);

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        return undefined;
      }

      const onPopState = () => {
        if (onIndexOrPublic) {
          void confirmExitApplication();
          window.history.pushState({ appBackHandler: true }, '', window.location.href);
          return;
        }

        router.replace(HOME_HREF);
      };

      // Sentinel: o próximo "voltar" do sistema/navegador dispara popstate aqui,
      // em vez de restaurar a rota anterior (ex.: /perfil).
      window.history.pushState({ appBackHandler: true }, '', window.location.href);
      window.addEventListener('popstate', onPopState);

      return () => {
        window.removeEventListener('popstate', onPopState);
      };
    }

    const onHardwareBackPress = () => {
      if (onIndexOrPublic) {
        void confirmExitApplication();
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
