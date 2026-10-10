import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAppParameterValue } from '@/lib/appParameters';
import {
  APP_PARAMETER,
  isEventGeoCheckinEnabled,
  isEventWithinGeofenceCheckinWindow,
  parseGeofenceHoursBeforeParameter,
} from '@/lib/checkInVisibility';
import { DEFAULT_EVENT_GEOFENCE_RADIUS_METERS } from '@/lib/checkinGeofence';
import {
  fetchFamilyHasEventAudience,
  fetchFamilyHasGeoCheckinConfirmed,
} from '@/lib/familyPreCheckin';
import {
  formatGeofenceHoursBeforeLabel,
  formatGeofenceWindowStartLabel,
} from '@/lib/geoCheckinWindow';
import { useEventGeofenceCoordinates } from '@/hooks/useEventGeofenceCoordinates';
import { useGeoCheckinMonitor } from '@/hooks/useGeoCheckinMonitor';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';

export function useLiveFamilyGeoCheckin(options: {
  events: ReadonlyArray<ActiveEventListItem>;
  preferredEventId: string | null | undefined;
  familyId: string | null | undefined;
  onNeedsAudience?: (eventId: string) => void;
  onConfirmed?: () => void | Promise<void>;
}) {
  const { events, preferredEventId, familyId, onNeedsAudience, onConfirmed } = options;
  const [geoCheckinTempoValue, setGeoCheckinTempoValue] = useState<string | null>(null);
  const [hasFamilyPreCheckin, setHasFamilyPreCheckin] = useState(false);
  const [hasFamilyGeoCheckinConfirmed, setHasFamilyGeoCheckinConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const tempo = await getAppParameterValue(APP_PARAMETER.CHECK_IN_GEOFENCE_TEMPO);

        if (cancelled) {
          return;
        }

        setGeoCheckinTempoValue(tempo?.trim() || null);
      } catch (error) {
        console.warn('Parâmetros de geofence:', error);
        if (!cancelled) {
          setGeoCheckinTempoValue(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const geoCheckinHoursBefore = useMemo(
    () => parseGeofenceHoursBeforeParameter(geoCheckinTempoValue),
    [geoCheckinTempoValue]
  );

  const targetEvent = useMemo(() => {
    const preferred = events.find((event) => event.id === preferredEventId);

    if (isEventGeoCheckinEnabled(preferred)) {
      return preferred ?? null;
    }

    return (
      events.find(
        (event) =>
          isEventGeoCheckinEnabled(event)
          && isEventWithinGeofenceCheckinWindow(event.event_date, geoCheckinHoursBefore)
      )
      ?? events.find((event) => isEventGeoCheckinEnabled(event))
      ?? null
    );
  }, [events, geoCheckinHoursBefore, preferredEventId]);

  const geoCheckinAtivoEnabled = isEventGeoCheckinEnabled(targetEvent);

  const {
    coordinates: eventGeofenceCoordinates,
    radiusMeters: eventGeofenceRadiusMeters,
    loading: eventGeofenceLoading,
    error: eventGeofenceError,
  } = useEventGeofenceCoordinates(
    targetEvent?.event_local,
    geoCheckinAtivoEnabled && Boolean(targetEvent?.event_local?.trim())
  );

  const geoCheckinRadiusMeters = eventGeofenceRadiusMeters ?? DEFAULT_EVENT_GEOFENCE_RADIUS_METERS;

  const geoCheckinEvent = useMemo(
    () =>
      targetEvent
        ? {
            id: targetEvent.id,
            event_date: targetEvent.event_date,
            latitude: eventGeofenceCoordinates?.latitude ?? null,
            longitude: eventGeofenceCoordinates?.longitude ?? null,
          }
        : null,
    [
      eventGeofenceCoordinates?.latitude,
      eventGeofenceCoordinates?.longitude,
      targetEvent,
    ]
  );

  const refetchGate = useCallback(async () => {
    if (!geoCheckinAtivoEnabled || !targetEvent?.id || !familyId?.trim()) {
      setHasFamilyPreCheckin(false);
      setHasFamilyGeoCheckinConfirmed(false);
      return;
    }

    const [audience, geoConfirmed] = await Promise.all([
      fetchFamilyHasEventAudience(targetEvent.id, familyId),
      fetchFamilyHasGeoCheckinConfirmed(targetEvent.id, familyId),
    ]);

    setHasFamilyPreCheckin(audience.hasPreCheckin);
    setHasFamilyGeoCheckinConfirmed(geoConfirmed.isConfirmed);
  }, [familyId, geoCheckinAtivoEnabled, targetEvent?.id]);

  useEffect(() => {
    void refetchGate();
  }, [refetchGate]);

  const handleNeedsAudience = useCallback(() => {
    if (targetEvent?.id) {
      onNeedsAudience?.(targetEvent.id);
    }
  }, [onNeedsAudience, targetEvent?.id]);

  const handleConfirmed = useCallback(async () => {
    await refetchGate();
    await onConfirmed?.();
  }, [onConfirmed, refetchGate]);

  const monitor = useGeoCheckinMonitor({
    enabled: geoCheckinAtivoEnabled,
    geofenceHoursBefore: geoCheckinHoursBefore,
    geofenceRadiusMeters: geoCheckinRadiusMeters,
    event: geoCheckinEvent,
    familyId: familyId ?? undefined,
    hasFamilyPreCheckin,
    hasFamilyGeoCheckinConfirmed,
    onRequiresPrecheckin: handleNeedsAudience,
    onConfirmed: handleConfirmed,
  });

  const inGeofenceWindow = monitor.inGeofenceWindow;
  const geoCheckinWindowStartLabel = useMemo(
    () => formatGeofenceWindowStartLabel(targetEvent?.event_date, geoCheckinHoursBefore),
    [geoCheckinHoursBefore, targetEvent?.event_date]
  );

  const missingCoordinates =
    geoCheckinAtivoEnabled
    && inGeofenceWindow
    && Boolean(targetEvent?.event_local?.trim())
    && !eventGeofenceLoading
    && !eventGeofenceCoordinates;

  const windowHint =
    geoCheckinAtivoEnabled
    && Boolean(targetEvent?.event_date)
    && !inGeofenceWindow
    && !hasFamilyGeoCheckinConfirmed
      ? `Check-in por proximidade inicia ${formatGeofenceHoursBeforeLabel(geoCheckinHoursBefore)}${
          geoCheckinWindowStartLabel ? ` (${geoCheckinWindowStartLabel})` : ''
        }.`
      : null;

  const missingCoordinatesHint = missingCoordinates
    ? `Local «${targetEvent?.event_local}» sem coordenadas nos locais favoritos. Cadastre latitude/longitude em Manutenção → Locais favoritos.`
    : null;

  return {
    targetEvent,
    geoCheckinAtivoEnabled,
    geoCheckinHoursBefore,
    geoCheckinRadiusMeters,
    eventGeofenceCoordinates,
    eventGeofenceLoading,
    eventGeofenceError,
    hasFamilyPreCheckin,
    hasFamilyGeoCheckinConfirmed,
    windowHint,
    missingCoordinatesHint,
    refetchGate,
    ...monitor,
  };
}
