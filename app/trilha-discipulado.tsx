import { DiscipleshipTrailPanel } from '@/components/DiscipleshipTrailPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import {
  isMinimalPresentationRoute,
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function TrilhaDiscipuladoScreen() {
  const params = useLocalSearchParams<{ presentation?: string | string[]; returnRoute?: string | string[]; returnDashboardCard?: string | string[] }>();
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.discipleshipTrail,
    deniedMessage: 'Você não tem permissão para abrir a Trilha de Discipulado.',
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout
        showGreeting={false}
        scroll={false}
        contentContainerStyle={styles.content}
        footer={<CloseFooterBar onPress={returnToCaller} />}
      >
        <KnowledgeSectionTitle
          title="Trilha de Discipulado"
          routeKey={KNOWLEDGE_ROUTE.trilha}
          titleStyle={styles.title}
        />
        <View style={[styles.panel, isMinimalPresentation && styles.panelMinimal]}>
          <DiscipleshipTrailPanel />
        </View>
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 0,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    paddingHorizontal: 16,
  },
  panel: {
    flex: 1,
    minHeight: 0,
  },
  panelMinimal: {
    flex: 1,
  },
});
