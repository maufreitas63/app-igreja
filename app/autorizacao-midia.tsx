import { AuthorizationForm } from '@/components/AuthorizationForm';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useMediaAuthorizationAccess } from '@/hooks/useMediaAuthorizationAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import {
  isMinimalPresentationRoute,
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';

export default function MediaAuthorizationScreen() {
  const params = useLocalSearchParams();
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);
  const { status, sessionProfileId } = useMediaAuthorizationAccess();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });

  const content = sessionProfileId ? (
    <AuthorizationForm profileId={sessionProfileId} />
  ) : null;

  return (
    <ScreenAccessGate status={status}>
      {isMinimalPresentation ? (
        <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
          <View style={styles.root}>{content}</View>
        </MinimalScreenLayout>
      ) : (
        <View style={styles.legacyRoot}>{content}</View>
      )}
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: MINIMAL_UI.background,
  },
  legacyRoot: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
    padding: 16,
  },
});
