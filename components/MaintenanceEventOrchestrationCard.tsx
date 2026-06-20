import { EventOrchestratorPanel } from '@/components/EventOrchestratorPanel';
import { setEventOrchestrationPanelFocused } from '@/lib/eventOrchestrationPanelFocus';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React, { useEffect } from 'react';
import { View } from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

export function MaintenanceEventOrchestrationCard({ isActive = true, panelHeight }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    setEventOrchestrationPanelFocused(true);

    return () => {
      setEventOrchestrationPanelFocused(false);
    };
  }, [isActive]);

  return (
    <View style={[maintenancePanelStyles.panel, { maxHeight: contentHeight }]}>
      <EventOrchestratorPanel isActive={isActive} compact showTitle={false} />
    </View>
  );
}
