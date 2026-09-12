import { PrimiciasPanel, type PrimiciasPanelHandle } from '@/components/PrimiciasPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native';

export default function PrimiciasScreen() {
  const params = useLocalSearchParams();
  const panelRef = useRef<PrimiciasPanelHandle>(null);
  const closingRef = useRef(false);
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.primicias,
    deniedMessage: 'Você não tem permissão para abrir a campanha Prímicias.',
  });

  const handleClose = useCallback(async () => {
    if (closingRef.current) {
      return;
    }

    if (panelRef.current?.collapseOpenSections()) {
      return;
    }

    closingRef.current = true;

    try {
      await panelRef.current?.closeWithCalendarOffer();
    } finally {
      returnToCaller();
    }
  }, [returnToCaller]);

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={() => void handleClose()} />}>
        <KnowledgeSectionTitle
          title="Prímicias"
          routeKey={KNOWLEDGE_ROUTE.primiciasMember}
          titleStyle={styles.title}
        />
        <PrimiciasPanel ref={panelRef} />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    paddingHorizontal: 16,
  },
});
