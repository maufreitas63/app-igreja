import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { VisitorQuickCheckinPanel } from '@/components/VisitorQuickCheckinPanel';
import { useVisitorQuickCheckinAccess } from '@/hooks/useVisitorQuickCheckinAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function VisitantesCadastroRapidoScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
    fallbackDashboardCard: 'visitor_quick_checkin',
  });
  const accessStatus = useVisitorQuickCheckinAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
        <VisitorQuickCheckinPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}
