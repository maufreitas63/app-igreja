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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
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

  const accessStatus = useSuggestionsImprovementsAccess({
    redirectPath: returnRoute === '/administrativo' ? '/administrativo' : '/(tabs)/dashboard',
  });

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
        <View className="shrink-0 gap-1 bg-minimal-bg pb-2">
          <Text className="w-full self-stretch text-center text-minimal-section text-minimal-blue-dark">
            Sugestões e Melhorias
          </Text>
          <Text
            className="text-center text-[13px] font-bold opacity-90"
            style={{ color: VIGILANCE_SCALES_UI.accent }}
          >
            Registrar solicitação
          </Text>
        </View>

        <View className="min-h-0 flex-1 bg-minimal-bg">
          <MaintenanceSupportSuggestionsCard
            isActive
            panelHeight={panelHeight}
            initialMode={initialMode}
            returnOnCreate
            variant="vigilance"
            fillContainer
            hidePanelHeader
            onNavigateBack={handleReturnToAdministrativo}
            onRequestCreated={handleReturnToAdministrativo}
          />
        </View>
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}
