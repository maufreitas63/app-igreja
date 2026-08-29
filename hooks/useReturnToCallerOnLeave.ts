import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { isDrawerNavigationPending } from '@/lib/drawerNavigationIntent';
import { useNavigation, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

const BACK_ACTION_TYPES = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);

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
      if (allowLeaveRef.current || isDrawerNavigationPending()) {
        return;
      }

      const actionType = String(
        (event.data as { action?: { type?: string } } | undefined)?.action?.type ?? ''
      );

      // Menu, deep link e replace para outra tela devem seguir. Só o voltar
      // do aparelho/histórico é desviado para o Índice.
      if (actionType && !BACK_ACTION_TYPES.has(actionType)) {
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
