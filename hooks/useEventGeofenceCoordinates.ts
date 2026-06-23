import { resolveEventGeofenceCoordinates } from '@/lib/eventGeofenceCoordinates';
import { fetchEventFavoriteLocations } from '@/lib/eventFavoriteLocationsApi';
import type { GeoCoordinates } from '@/lib/checkinGeofence';
import { useCallback, useEffect, useState } from 'react';

export function useEventGeofenceCoordinates(
  eventLocal: string | null | undefined,
  enabled = true
) {
  const [coordinates, setCoordinates] = useState<GeoCoordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setCoordinates(null);
      setLoading(false);
      setError(null);
      setSchemaMissing(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchEventFavoriteLocations();
      setSchemaMissing(result.schemaMissing);

      if (result.schemaMissing) {
        setCoordinates(null);
        return;
      }

      setCoordinates(resolveEventGeofenceCoordinates(eventLocal, result.rows));
    } catch (err) {
      console.error('Erro ao resolver coordenadas do evento:', err);
      setCoordinates(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as coordenadas do local do evento.'
      );
    } finally {
      setLoading(false);
    }
  }, [enabled, eventLocal]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    coordinates,
    loading,
    error,
    schemaMissing,
    refetch,
  };
}
