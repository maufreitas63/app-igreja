import {
  fetchEventQuorumRegistry,
  QuorumRegistryUnavailableError,
  type QuorumRegistryRow,
} from '@/lib/quorumRegistry';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useQuorumRegistry(
  eventId: string | undefined,
  options?: { pollMs?: number; enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const [rows, setRows] = useState<QuorumRegistryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const requestIdRef = useRef(0);

  const refetch = useCallback(
    async (silent = false) => {
      if (!eventId || !enabled) {
        setRows([]);
        setError(null);
        setLoading(false);
        setIsRefreshing(false);
        setHasLoadedOnce(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const next = await fetchEventQuorumRegistry(eventId);
        if (requestIdRef.current !== requestId) {
          return;
        }
        setRows(next ?? []);
        setHasLoadedOnce(true);
      } catch (err) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        const message =
          err instanceof QuorumRegistryUnavailableError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Não foi possível carregar o registro de quórum.';
        setError(message);
        setRows([]);
        setHasLoadedOnce(true);
      } finally {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [enabled, eventId]
  );

  useEffect(() => {
    setHasLoadedOnce(false);
    void refetch(false);
  }, [refetch]);

  useEffect(() => {
    const pollMs = options?.pollMs;
    if (!eventId || !enabled || !pollMs || pollMs < 1000) {
      return;
    }

    const timer = setInterval(() => {
      void refetch(true);
    }, pollMs);

    return () => clearInterval(timer);
  }, [enabled, eventId, options?.pollMs, refetch]);

  return { rows, loading, isRefreshing, error, hasLoadedOnce, refetch };
}
