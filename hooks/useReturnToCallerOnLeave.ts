import { buildReturnToDashboardHref } from '@/lib/dashboardReturnNavigation';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

type UseReturnToCallerOnLeaveOptions = {
  returnDashboardCard?: string | null;
  fallbackDashboardCard?: string | null;
  extraRouteParams?: Record<string, string | undefined>;
};

export function useReturnToCallerOnLeave({
  returnDashboardCard,
  fallbackDashboardCard = null,
  extraRouteParams,
}: UseReturnToCallerOnLeaveOptions) {
  const router = useRouter();
  const navigation = useNavigation();
  const allowLeaveRef = useRef(false);

  const returnToCaller = useCallback(() => {
    allowLeaveRef.current = true;

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
  }, [extraRouteParams, fallbackDashboardCard, returnDashboardCard, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) {
        return;
      }

      event.preventDefault();
      returnToCaller();
    });

    return unsubscribe;
  }, [navigation, returnToCaller]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToCaller();
      return true;
    });

    return () => subscription.remove();
  }, [returnToCaller]);

  return returnToCaller;
}
