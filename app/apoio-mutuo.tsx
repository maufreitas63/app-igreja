import { ApoioMutuoPanel } from '@/components/ApoioMutuoPanel';
import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { computeEventPanelCardHeight } from '@/lib/dashboardPanelLayout';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ApoioMutuoScreen() {
  const params = useLocalSearchParams();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
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
    <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
      <View style={styles.stage}>
        <ApoioMutuoPanel panelHeight={panelHeight} isActive />
      </View>
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
