import { PrimiciasPanel } from '@/components/PrimiciasPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function PrimiciasScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.primicias,
    deniedMessage: 'Você não tem permissão para abrir a campanha Prímicias.',
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
        <PrimiciasPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}
