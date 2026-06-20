import { EventOrchestratorPanel } from '@/components/EventOrchestratorPanel';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React from 'react';
import { View } from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

export function MaintenanceEventOrchestrationCard({ isActive = true, panelHeight }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  return (
    <View style={[maintenancePanelStyles.panel, { maxHeight: contentHeight }]}>
      <EventOrchestratorPanel isActive={isActive} compact showTitle={false} />
    </View>
  );
}
