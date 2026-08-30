import { SmallGroupCard } from '@/components/SmallGroupCard';
import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { computeEventPanelCardHeight } from '@/lib/dashboardPanelLayout';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PequenoGrupoScreen() {
  const params = useLocalSearchParams();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const accessStatus = useDashboardCardRouteAccess({
    resourceKey: ACCESS_DASHBOARD_CARD.smallGroup,
    deniedMessage: 'Você não tem permissão para abrir Minha Célula.',
    requireActiveMembership: true,
  });
  const panelHeight = useMemo(
    () =>
      Math.max(
        280,
        computeEventPanelCardHeight(windowHeight, insets.top, insets.bottom) - CLOSE_FOOTER_DOCK_HEIGHT
      ),
    [insets.bottom, insets.top, windowHeight]
  );

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
        <View style={styles.stage}>
          <SmallGroupCard panelHeight={panelHeight} isActive />
        </View>
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
