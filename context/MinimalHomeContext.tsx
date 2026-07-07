import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type MinimalMainPanelKey = 'events' | 'financial';

type MinimalHomeContextValue = {
  expandedEventId: string | null;
  expandedEvent: ActiveEventListItem | null;
  setExpandedEvent: (event: ActiveEventListItem | null) => void;
  activeMainPanel: MinimalMainPanelKey;
  setActiveMainPanel: (panel: MinimalMainPanelKey) => void;
};

const MinimalHomeContext = createContext<MinimalHomeContextValue>({
  expandedEventId: null,
  expandedEvent: null,
  setExpandedEvent: () => undefined,
  activeMainPanel: 'events',
  setActiveMainPanel: () => undefined,
});

export function MinimalHomeProvider({ children }: { children: React.ReactNode }) {
  const [expandedEvent, setExpandedEventState] = useState<ActiveEventListItem | null>(null);
  const [activeMainPanel, setActiveMainPanelState] = useState<MinimalMainPanelKey>('events');

  const setExpandedEvent = useCallback((event: ActiveEventListItem | null) => {
    setExpandedEventState(event);
  }, []);

  const setActiveMainPanel = useCallback((panel: MinimalMainPanelKey) => {
    setActiveMainPanelState(panel);
  }, []);

  const value = useMemo(
    () => ({
      expandedEventId: expandedEvent?.id ?? null,
      expandedEvent,
      setExpandedEvent,
      activeMainPanel,
      setActiveMainPanel,
    }),
    [activeMainPanel, expandedEvent, setActiveMainPanel, setExpandedEvent]
  );

  return <MinimalHomeContext.Provider value={value}>{children}</MinimalHomeContext.Provider>;
}

export function useMinimalHome() {
  return useContext(MinimalHomeContext);
}
