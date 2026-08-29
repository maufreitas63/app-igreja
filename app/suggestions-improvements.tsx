import { MaintenanceSupportSuggestionsCard } from '@/components/MaintenanceSupportSuggestionsCard';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useSuggestionsImprovementsAccess } from '@/hooks/useSuggestionsImprovementsAccess';
import {
  pickRouteParam,
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
  withMinimalPresentation,
} from '@/lib/dashboardReturnNavigation';
import { computeDashboardCardHeight } from '@/lib/dashboardPanelLayout';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SuggestionsImprovementsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    supportMode?: string;
    returnDashboardCard?: string;
    returnRoute?: string;
    presentation?: string;
  }>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelHeight = useMemo(
    () => computeDashboardCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.bottom, insets.top, windowHeight]
  );

  const returnDashboardCard = resolveReturnDashboardCardParam(params);
  const returnRoute = resolveReturnRouteParam(params);
  const initialMode = pickRouteParam(params.supportMode) === 'new' ? 'new' : 'list';
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute,
    returnDashboardCard,
  });

  const accessStatus = useSuggestionsImprovementsAccess({
    redirectPath: returnRoute === '/administrativo' ? '/administrativo' : MEMBER_HOME_PATH,
  });

  const handleLeave = useCallback(() => {
    if (returnRoute === '/administrativo') {
      router.replace({
        pathname: '/administrativo',
        params: withMinimalPresentation(),
      } as Href);
      return;
    }

    returnToCaller();
  }, [returnRoute, returnToCaller, router]);

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout
        scroll={false}
        footer={<CloseFooterBar onPress={handleLeave} />}
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Sugestões e Melhorias</Text>
          <Text style={styles.badgeTitle}>Registrar solicitação</Text>
        </View>

        <View style={styles.cardStage}>
          <MaintenanceSupportSuggestionsCard
            isActive
            panelHeight={panelHeight}
            initialMode={initialMode}
            returnOnCreate
            variant="vigilance"
            fillContainer
            hidePanelHeader
            onNavigateBack={handleLeave}
            onRequestCreated={handleLeave}
          />
        </View>
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  header: {
    flexShrink: 0,
    gap: 4,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
  },
  welcomeText: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  badgeTitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.9,
  },
  cardStage: {
    flex: 1,
    minHeight: 0,
    backgroundColor: MINIMAL_UI.background,
  },
});
