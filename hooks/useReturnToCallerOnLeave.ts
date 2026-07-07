import { buildReturnToDashboardHref, withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
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
  returnRoute,
  returnDashboardCard,
  fallbackDashboardCard = null,
  extraRouteParams,
  managedByParent = false,
}: UseReturnToCallerOnLeaveOptions) {
  const router = useRouter();
  const navigation = useNavigation();
  const allowLeaveRef = useRef(false);

  const returnToCaller = useCallback(() => {
    allowLeaveRef.current = true;

    if (returnRoute) {
      const params: Record<string, string> = withMinimalPresentation();

      if (extraRouteParams) {
        for (const [key, value] of Object.entries(extraRouteParams)) {
          if (value) {
            params[key] = value;
          }
        }
      }

      router.replace({
        pathname: returnRoute,
        params,
      } as Href);
      return;
    }

    const dashboardCard = returnDashboardCard ?? fallbackDashboardCard;
    if (dashboardCard) {
      router.replace(buildReturnToDashboardHref(dashboardCard, extraRouteParams));
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)');
  }, [extraRouteParams, fallbackDashboardCard, returnDashboardCard, returnRoute, router]);

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
