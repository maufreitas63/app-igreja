import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MinimalHomeContextValue = {
  expandedEventId: string | null;
  expandedEvent: ActiveEventListItem | null;
  setExpandedEvent: (event: ActiveEventListItem | null) => void;
  homeAgendaOpen: boolean;
  setHomeAgendaOpen: (open: boolean) => void;
};

const MinimalHomeContext = createContext<MinimalHomeContextValue>({
  expandedEventId: null,
  expandedEvent: null,
  setExpandedEvent: () => undefined,
  homeAgendaOpen: false,
  setHomeAgendaOpen: () => undefined,
});

export function MinimalHomeProvider({ children }: { children: React.ReactNode }) {
  const [expandedEvent, setExpandedEventState] = useState<ActiveEventListItem | null>(null);
  const [homeAgendaOpen, setHomeAgendaOpen] = useState(false);

  const setExpandedEvent = useCallback((event: ActiveEventListItem | null) => {
    setExpandedEventState(event);
  }, []);

  const value = useMemo(
    () => ({
      expandedEventId: expandedEvent?.id ?? null,
      expandedEvent,
      setExpandedEvent,
      homeAgendaOpen,
      setHomeAgendaOpen,
    }),
    [expandedEvent, homeAgendaOpen, setExpandedEvent]
  );

  return <MinimalHomeContext.Provider value={value}>{children}</MinimalHomeContext.Provider>;
}

export function useMinimalHome() {
  return useContext(MinimalHomeContext);
}
