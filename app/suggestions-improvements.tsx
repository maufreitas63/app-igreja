import { MaintenanceSupportSuggestionsCard } from '@/components/MaintenanceSupportSuggestionsCard';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useSuggestionsImprovementsAccess } from '@/hooks/useSuggestionsImprovementsAccess';
import {
  DASHBOARD_ADMINISTRATIVO_CARD_ID,
} from '@/lib/administrativoModule';
import {
  buildReturnToDashboardHref,
  pickRouteParam,
  resolveReturnRouteParam,
  withMinimalPresentation,
} from '@/lib/dashboardReturnNavigation';
import { computeDashboardCardHeight } from '@/lib/dashboardPanelLayout';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useMemo } from 'react';
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

  const returnDashboardCard =
    pickRouteParam(params.returnDashboardCard) ?? DASHBOARD_ADMINISTRATIVO_CARD_ID;
  const returnRoute = resolveReturnRouteParam(params);
  const initialMode = pickRouteParam(params.supportMode) === 'new' ? 'new' : 'list';

  const accessStatus = useSuggestionsImprovementsAccess();

  const handleReturnToAdministrativo = () => {
    if (returnRoute === '/administrativo') {
      router.replace({
        pathname: '/administrativo',
        params: withMinimalPresentation({ administrativoTab: 'outros' }),
      } as Href);
      return;
    }

    router.replace(
      buildReturnToDashboardHref(returnDashboardCard, {
        administrativoTab: 'outros',
      })
    );
  };

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false}>
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
            onNavigateBack={handleReturnToAdministrativo}
            onRequestCreated={handleReturnToAdministrativo}
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
