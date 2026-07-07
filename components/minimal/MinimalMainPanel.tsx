import { EventsInboxHome } from '@/components/minimal/EventsInboxHome';
import { MinimalFinancialCard } from '@/components/minimal/MinimalFinancialCard';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';

/** Conteúdo principal da home minimalista (eventos ou card financeiro). */
export function MinimalMainPanel() {
  const { mainPanel, mainPanelNonce } = useLocalSearchParams<{
    mainPanel?: string | string[];
    mainPanelNonce?: string | string[];
  }>();
  const { activeMainPanel, setActiveMainPanel } = useMinimalHome();

  const panelParam = Array.isArray(mainPanel) ? mainPanel[0] : mainPanel;
  const nonceParam = Array.isArray(mainPanelNonce) ? mainPanelNonce[0] : mainPanelNonce;

  useEffect(() => {
    if (panelParam === 'financial') {
      setActiveMainPanel('financial');
      return;
    }

    if (panelParam === 'events') {
      setActiveMainPanel('events');
    }
  }, [panelParam, nonceParam, setActiveMainPanel]);

  if (activeMainPanel === 'financial') {
    return <MinimalFinancialCard />;
  }

  return <EventsInboxHome />;
}
