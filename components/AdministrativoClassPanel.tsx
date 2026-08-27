import { AdministrativoClass } from '@/components/AdministrativoClass';
import {
  pickRouteParam,
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
  withMinimalPresentation,
  withReturnRoute,
} from '@/lib/dashboardReturnNavigation';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/** Container com navegação — compõe o AdministrativoClass com abas e RD. */
export function AdministrativoClassPanel() {
  const router = useRouter();
  const params = useLocalSearchParams<{ administrativoTab?: string }>();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
    fallbackDashboardCard: 'administrativo',
  });

  const initialTab = useMemo(() => {
    // Aba "outros" descontinuada temporariamente — sempre Atos.
    void pickRouteParam(params.administrativoTab);
    return 'atas' as const;
  }, [params.administrativoTab]);

  const handleOpenExpenseReport = useCallback(() => {
    router.push({
      pathname: '/expense-report',
      params: withReturnRoute('/administrativo', withMinimalPresentation()),
    });
  }, [router]);

  const handleClose = useCallback(() => {
    returnToCaller();
  }, [returnToCaller]);

  return (
    <View style={styles.root}>
      <AdministrativoClass
        initialTab={initialTab}
        onPressRd={handleOpenExpenseReport}
        onClose={handleClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
