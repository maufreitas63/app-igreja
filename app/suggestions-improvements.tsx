import { MaintenanceSupportSuggestionsCard } from '@/components/MaintenanceSupportSuggestionsCard';
import { ActiveScreenBadge } from '@/components/ui/ActiveScreenBadge';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useSuggestionsImprovementsAccess } from '@/hooks/useSuggestionsImprovementsAccess';
import {
  DASHBOARD_ADMINISTRATIVO_CARD_ID,
} from '@/lib/administrativoModule';
import {
  buildReturnToDashboardHref,
  pickRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { computeDashboardCardHeight } from '@/lib/dashboardPanelLayout';
import { buildDashboardScreenGradient } from '@/lib/paletteTheme';
import { usePalette } from '@/context/PaletteContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SuggestionsImprovementsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    supportMode?: string;
    returnDashboardCard?: string;
  }>();
  const { colors: paletteColors } = usePalette();
  const screenGradient = useMemo(
    () => buildDashboardScreenGradient(paletteColors),
    [paletteColors]
  );
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelHeight = useMemo(
    () => computeDashboardCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.bottom, insets.top, windowHeight]
  );

  const returnDashboardCard =
    pickRouteParam(params.returnDashboardCard) ?? DASHBOARD_ADMINISTRATIVO_CARD_ID;
  const initialMode = pickRouteParam(params.supportMode) === 'new' ? 'new' : 'list';

  const accessStatus = useSuggestionsImprovementsAccess();

  const handleReturnToAdministrativo = () => {
    router.replace(
      buildReturnToDashboardHref(returnDashboardCard, {
        administrativoTab: 'outros',
      })
    );
  };

  return (
    <ScreenAccessGate status={accessStatus}>
      <LinearGradient colors={screenGradient} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <View style={styles.welcomeBox}>
              <Text style={styles.welcomeText}>Sugestões e Melhorias</Text>
              <ActiveScreenBadge
                title="Registrar solicitação"
                accent="emerald"
                technicalKey="maintenance.card.suggestions_improvements"
              />
            </View>
          </View>

          <View style={styles.cardStage}>
            <MaintenanceSupportSuggestionsCard
              isActive
              panelHeight={panelHeight}
              initialMode={initialMode}
              returnOnCreate
              onNavigateBack={handleReturnToAdministrativo}
              onRequestCreated={handleReturnToAdministrativo}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  welcomeBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  welcomeText: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardStage: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
