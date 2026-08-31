import { LivrosDoadosPanel } from '@/components/LivrosDoadosPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

export default function LivrosDoadosScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.livrosDoados,
    deniedMessage: 'Você não tem permissão para cadastrar livros doados.',
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <Text style={styles.title}>Livros doados</Text>
        <LivrosDoadosPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    marginBottom: 12,
  },
});
