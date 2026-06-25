import {
  fetchMaintenanceSupportRequests,
  MAINTENANCE_SUPPORT_SQL_HINT,
  type MaintenanceSupportRequest,
} from '@/lib/maintenanceSupportApi';
import { useCallback, useEffect, useState } from 'react';

export function useMaintenanceSupport(enabled: boolean) {
  const [requests, setRequests] = useState<MaintenanceSupportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!enabled) {
        return;
      }

      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchMaintenanceSupportRequests();
        setRequests(result.rows);
        setSchemaMissing(result.schemaMissing);
      } catch (loadError) {
        console.error('Erro ao carregar sugestões e melhorias:', loadError);
        setRequests([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar sugestões e melhorias.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled || schemaMissing) {
      return;
    }

    const timer = setInterval(() => {
      void reload({ silent: true });
    }, 30_000);

    return () => clearInterval(timer);
  }, [enabled, reload, schemaMissing]);

  return {
    requests,
    loading,
    refreshing,
    schemaMissing,
    schemaHint: MAINTENANCE_SUPPORT_SQL_HINT,
    error,
    reload,
  };
}
