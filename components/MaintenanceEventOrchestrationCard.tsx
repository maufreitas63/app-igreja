import { EventOrchestratorPanel } from '@/components/EventOrchestratorPanel';
import { setEventOrchestrationPanelFocused } from '@/lib/eventOrchestrationPanelFocus';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_FLAT_PANEL } from '@/lib/minimalPresentation';
import React, { useEffect } from 'react';
import { View } from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

export function MaintenanceEventOrchestrationCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
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
    <View
      style={[
        maintenancePanelStyles.panel,
        minimal && MINIMAL_FLAT_PANEL,
        { maxHeight: contentHeight },
      ]}
    >
      <EventOrchestratorPanel isActive={isActive} compact showTitle={false} minimal={minimal} />
    </View>
  );
}
