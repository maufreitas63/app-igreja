import {
  createEventFavoriteLocation,
  deleteEventFavoriteLocation,
  EVENT_FAVORITE_LOCATIONS_CEP_SQL_HINT,
  EVENT_FAVORITE_LOCATIONS_SQL_HINT,
  fetchEventFavoriteLocations,
  updateEventFavoriteLocation,
  type EventFavoriteLocation,
  type EventFavoriteLocationInput,
} from '@/lib/eventFavoriteLocationsApi';
import { useCallback, useEffect, useState } from 'react';

export { EVENT_FAVORITE_LOCATIONS_CEP_SQL_HINT, EVENT_FAVORITE_LOCATIONS_SQL_HINT };

export function useEventFavoriteLocations(enabled = true) {
  const [locations, setLocations] = useState<EventFavoriteLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [cepColumnMissing, setCepColumnMissing] = useState(false);
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
      setCepColumnMissing(result.cepColumnMissing);
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

  const saveLocation = useCallback(
    async (input: EventFavoriteLocationInput, locationId?: string | null) => {
      setSaving(true);
      setError(null);

      const payload = cepColumnMissing ? { ...input, cep: null } : input;

      try {
        const saved = locationId
          ? await updateEventFavoriteLocation(locationId, payload)
          : await createEventFavoriteLocation(payload);

        await reload();
        return saved;
      } catch (saveError) {
        console.error('Erro ao salvar local favorito:', saveError);
        const message =
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível salvar o local favorito.';

        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [cepColumnMissing, reload]
  );

  const removeLocation = useCallback(
    async (locationId: string) => {
      setDeletingId(locationId);
      setError(null);

      try {
        await deleteEventFavoriteLocation(locationId);
        await reload();
      } catch (deleteError) {
        console.error('Erro ao apagar local favorito:', deleteError);
        const message =
          deleteError instanceof Error
            ? deleteError.message
            : 'Não foi possível apagar o local favorito.';

        setError(message);
        throw new Error(message);
      } finally {
        setDeletingId(null);
      }
    },
    [reload]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    locations,
    loading,
    saving,
    deletingId,
    schemaMissing,
    cepColumnMissing,
    error,
    reload,
    saveLocation,
    removeLocation,
  };
}
