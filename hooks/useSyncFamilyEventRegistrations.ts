import { useCallback, useState } from 'react';
import type { GeoCoordinates } from '@/lib/checkinGeofence';
import {
  confirmGeoFamilyCheckinAtomic,
  syncFamilyEventRegistrationsAtomic,
} from '@/lib/geoCheckinApi';

export type SyncFamilyRegistrationsInput = {
  eventId: string;
  familyId: string;
  memberIds: string[];
  coordinates?: GeoCoordinates | null;
  skipGeofence?: boolean;
};

export const useSyncFamilyEventRegistrations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const syncFamilyRegistrations = useCallback(async (input: SyncFamilyRegistrationsInput) => {
    setLoading(true);
    setError(null);

    try {
      return await syncFamilyEventRegistrationsAtomic({
        eventId: input.eventId,
        familyId: input.familyId,
        memberIds: input.memberIds,
        latitude: input.coordinates?.latitude,
        longitude: input.coordinates?.longitude,
        skipGeofence: input.skipGeofence,
      });
    } catch (err) {
      const normalized =
        err instanceof Error ? err : new Error('Falha ao sincronizar audiência da família.');
      setError(normalized);
      throw normalized;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmGeoCheckin = useCallback(
    async (input: {
      eventId: string;
      familyId: string;
      coordinates?: GeoCoordinates | null;
      skipGeofence?: boolean;
    }) => {
      setLoading(true);
      setError(null);

      try {
        return await confirmGeoFamilyCheckinAtomic({
          eventId: input.eventId,
          familyId: input.familyId,
          latitude: input.coordinates?.latitude,
          longitude: input.coordinates?.longitude,
          skipGeofence: input.skipGeofence,
        });
      } catch (err) {
        const normalized =
          err instanceof Error ? err : new Error('Falha ao confirmar check-in por geolocalização.');
        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    syncFamilyRegistrations,
    confirmGeoCheckin,
    loading,
    error,
    reset,
  };
};
