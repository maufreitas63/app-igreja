import {
  EVENT_FAVORITE_LOCATIONS_SQL_HINT,
  fetchEventFavoriteLocations,
  type EventFavoriteLocation,
} from '@/lib/eventFavoriteLocationsApi';
import { useCallback, useEffect, useState } from 'react';

export { EVENT_FAVORITE_LOCATIONS_SQL_HINT };

export function useEventFavoriteLocations(enabled = true) {
  const [locations, setLocations] = useState<EventFavoriteLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchEventFavoriteLocations();
      setLocations(result.rows);
      setSchemaMissing(result.schemaMissing);
    } catch (loadError) {
      console.error('Erro ao carregar locais favoritos:', loadError);
      setLocations([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os locais favoritos.'
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    locations,
    loading,
    schemaMissing,
    error,
    reload,
  };
}
