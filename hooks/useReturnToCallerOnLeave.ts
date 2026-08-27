import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { useNavigation, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

type UseReturnToCallerOnLeaveOptions = {
  returnRoute?: string | null;
  returnDashboardCard?: string | null;
  fallbackDashboardCard?: string | null;
  extraRouteParams?: Record<string, string | undefined>;
  /** Overlay embutido com `onBack` — não intercepta navegação da rota pai. */
  managedByParent?: boolean;
};

export function useReturnToCallerOnLeave({
  managedByParent = false,
}: UseReturnToCallerOnLeaveOptions = {}) {
  const router = useRouter();
  const navigation = useNavigation();
  const allowLeaveRef = useRef(false);

  const returnToCaller = useCallback(() => {
    allowLeaveRef.current = true;

    // Fechar das telas → Índice. Encerrar sessão (MinimalExitBar) é quem fecha o app.
    router.replace({
      pathname: MEMBER_HOME_PATH,
      params: withMinimalPresentation(),
    } as Href);
  }, [router]);

  useEffect(() => {
    if (managedByParent) {
      return undefined;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) {
        return;
      }

      event.preventDefault();
      returnToCaller();
    });

    return unsubscribe;
  }, [managedByParent, navigation, returnToCaller]);

  useEffect(() => {
    if (managedByParent || Platform.OS !== 'android') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToCaller();
      return true;
    });

    return () => subscription.remove();
  }, [managedByParent, returnToCaller]);

  return returnToCaller;
}
