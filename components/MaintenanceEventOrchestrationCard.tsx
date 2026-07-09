import { EventOrchestratorPanel } from '@/components/EventOrchestratorPanel';
import { setEventOrchestrationPanelFocused } from '@/lib/eventOrchestrationPanelFocus';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

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
        minimal && styles.panelMinimal,
        { maxHeight: contentHeight },
      ]}
    >
      <EventOrchestratorPanel isActive={isActive} compact showTitle={false} minimal={minimal} />
    </View>
  );
}

const styles = StyleSheet.create({
  panelMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
