import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MinimalHomeContextValue = {
  expandedEventId: string | null;
  expandedEvent: ActiveEventListItem | null;
  setExpandedEvent: (event: ActiveEventListItem | null) => void;
};

const MinimalHomeContext = createContext<MinimalHomeContextValue>({
  expandedEventId: null,
  expandedEvent: null,
  setExpandedEvent: () => undefined,
});

export function MinimalHomeProvider({ children }: { children: React.ReactNode }) {
  const [expandedEvent, setExpandedEventState] = useState<ActiveEventListItem | null>(null);

  const setExpandedEvent = useCallback((event: ActiveEventListItem | null) => {
    setExpandedEventState(event);
  }, []);

  const value = useMemo(
    () => ({
      expandedEventId: expandedEvent?.id ?? null,
      expandedEvent,
      setExpandedEvent,
    }),
    [expandedEvent, setExpandedEvent]
  );

  return <MinimalHomeContext.Provider value={value}>{children}</MinimalHomeContext.Provider>;
}

export function useMinimalHome() {
  return useContext(MinimalHomeContext);
}
