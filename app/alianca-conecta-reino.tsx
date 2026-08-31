import { AliancaAdminDashboard } from '@/components/alianca/AliancaAdminDashboard';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useIgrejasAdminAccess } from '@/hooks/useIgrejasAdminAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function AliancaConectaReinoScreen() {
  const accessStatus = useIgrejasAdminAccess();
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <AliancaAdminDashboard />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}
