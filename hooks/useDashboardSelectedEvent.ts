import {
  getDashboardSelectedEventIdSync,
  readDashboardSelectedEventId,
  subscribeDashboardSelectedEventId,
  writeDashboardSelectedEventId,
} from '@/lib/dashboardSelectedEvent';
import { useCallback, useEffect, useState } from 'react';
import { useActiveEvents, type UseActiveEventsOptions } from './useActiveEvents';

export type UseDashboardSelectedEventOptions = UseActiveEventsOptions;

export const useDashboardSelectedEvent = (options?: UseDashboardSelectedEventOptions) => {
  const { events: activeEvents, loading, error, refetch } = useActiveEvents(options);
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(
    () => getDashboardSelectedEventIdSync()
  );

  useEffect(() => {
    let isMounted = true;

    void readDashboardSelectedEventId().then((storedId) => {
      if (isMounted && storedId) {
        setSelectedEventIdState(storedId);
      }
    });

    const unsubscribe = subscribeDashboardSelectedEventId(() => {
      setSelectedEventIdState(getDashboardSelectedEventIdSync());
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeEvents.length) {
      setSelectedEventIdState((current) => {
        if (current !== null) {
          void writeDashboardSelectedEventId(null);
        }
        return null;
      });
      return;
    }

    setSelectedEventIdState((current) => {
      const next =
        current && activeEvents.some((event) => event.id === current)
          ? current
          : activeEvents[0].id;

      if (next !== current) {
        void writeDashboardSelectedEventId(next);
      }

      return next;
    });
  }, [activeEvents]);

  const setSelectedEventId = useCallback(
    (value: string | null | ((current: string | null) => string | null)) => {
      setSelectedEventIdState((current) => {
        const next = typeof value === 'function' ? value(current) : value;
        void writeDashboardSelectedEventId(next);
        return next;
      });
    },
    []
  );

  const selectedEvent =
    activeEvents.find((event) => event.id === selectedEventId) ?? activeEvents[0] ?? null;

  const resolvedSelectedEventId = selectedEvent?.id ?? selectedEventId;

  return {
    activeEvents,
    events: activeEvents,
    selectedEvent,
    selectedEventId: resolvedSelectedEventId,
    setSelectedEventId,
    loading,
    error,
    refetch,
  };
};
