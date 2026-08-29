import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { EventOrchestratorPanel } from '@/components/EventOrchestratorPanel';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { usePalette } from '@/context/PaletteContext';
import { useEventOrchestratorScreenAccess } from '@/hooks/useEventOrchestratorScreenAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { buildIndexScreenGradient } from '@/lib/paletteTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventOrchestratorScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const { colors } = usePalette();
  const gradient = buildIndexScreenGradient(colors);
  const accessStatus = useEventOrchestratorScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <LinearGradient colors={gradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <Stack.Screen options={{ headerShown: false }} />
          <EventOrchestratorPanel contentContainerStyle={styles.content} />
          <CloseFooterBar onPress={returnToCaller} includeScreenPadding />
        </SafeAreaView>
      </LinearGradient>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
});
