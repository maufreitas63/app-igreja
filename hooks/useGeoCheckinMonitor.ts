import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import type { GeoCoordinates } from '@/lib/checkinGeofence';
import { eventHasGeofenceCoordinates } from '@/lib/checkinGeofence';
import {
  attachGeoCheckinOnlineSync,
  drainGeoCheckinQueue,
  enqueueGeoCheckinOperation,
  isDeviceOnline,
  type GeoCheckinQueueItem,
} from '@/lib/checkinOfflineQueue';
import {
  confirmGeoFamilyCheckinAtomic,
  formatGeoCheckinParticipantNames,
  syncFamilyEventRegistrationsAtomic,
} from '@/lib/geoCheckinApi';
import {
  formatDeviceGeolocationPermissionError,
  requestDeviceGeolocationPermission,
  startGeofenceValidationWatch,
} from '@/lib/deviceGeolocation';
import { isEventWithinGeofenceCheckinWindow } from '@/lib/checkInVisibility';

export type GeoCheckinUiStatus = 'idle' | 'detecting' | 'syncing' | 'confirmed' | 'error';

export type GeoCheckinEvent = {
  id: string;
  event_date: string | null | undefined;
  latitude?: number | null;
  longitude?: number | null;
};

export type UseGeoCheckinMonitorOptions = {
  enabled: boolean;
  geofenceHoursBefore: number;
  geofenceRadiusMeters?: number;
  event: GeoCheckinEvent | null | undefined;
  familyId: string | undefined;
  hasFamilyPreCheckin: boolean;
  hasFamilyGeoCheckinConfirmed?: boolean;
  onRequiresPrecheckin?: () => void;
  onConfirmed?: () => void | Promise<void>;
};

const notifyGeoCheckinConfirmed = (participantNames: string[] | undefined) => {
  const namesLabel = formatGeoCheckinParticipantNames(participantNames);
  const message = `Check-in registrado! Familiares presentes: ${namesLabel}`;

  Toast.show({
    type: 'success',
    text1: 'Check-in confirmado',
    text2: message,
    visibilityTime: 6000,
  });

  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  Alert.alert('Check-in registrado!', `Familiares presentes: ${namesLabel}`, [{ text: 'OK' }]);
};

const PROXIMITY_UI_THROTTLE_MS = 3000;

const processQueueItem = async (item: GeoCheckinQueueItem): Promise<boolean> => {
  if (item.type === 'confirm') {
    const result = await confirmGeoFamilyCheckinAtomic({
      eventId: item.eventId,
      familyId: item.familyId,
      latitude: item.latitude,
      longitude: item.longitude,
      skipGeofence: item.skipGeofence,
    });

    if (result.success) {
      notifyGeoCheckinConfirmed(result.participant_names);
    }

    return result.success;
  }

  if (item.type === 'sync_registrations') {
    const result = await syncFamilyEventRegistrationsAtomic({
      eventId: item.eventId,
      familyId: item.familyId,
      memberIds: item.memberIds,
      latitude: item.latitude,
      longitude: item.longitude,
      skipGeofence: item.skipGeofence,
    });

    return result.success;
  }

  return false;
};

export const useGeoCheckinMonitor = ({
  enabled,
  geofenceHoursBefore,
  geofenceRadiusMeters,
  event,
  familyId,
  hasFamilyPreCheckin,
  hasFamilyGeoCheckinConfirmed = false,
  onRequiresPrecheckin,
  onConfirmed,
}: UseGeoCheckinMonitorOptions) => {
  const [status, setStatus] = useState<GeoCheckinUiStatus>('idle');
  const [gpsProgress, setGpsProgress] = useState({ current: 0, required: 3 });
  const [lastCoordinates, setLastCoordinates] = useState<GeoCoordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastDistanceMeters, setLastDistanceMeters] = useState<number | null>(null);
  const [lastGpsAccuracyMeters, setLastGpsAccuracyMeters] = useState<number | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const triggeredRef = useRef(false);
  const precheckinPromptShownRef = useRef(false);
  const pendingConfirmCoordsRef = useRef<GeoCoordinates | null>(null);
  const onConfirmedRef = useRef(onConfirmed);
  const onRequiresPrecheckinRef = useRef(onRequiresPrecheckin);
  const proximityUiRef = useRef({
    lastEmitAt: 0,
    distanceMeters: null as number | null,
    accuracyMeters: null as number | null,
    progressCurrent: 0,
    progressRequired: 3,
  });
  const [windowTick, setWindowTick] = useState(0);

  onConfirmedRef.current = onConfirmed;
  onRequiresPrecheckinRef.current = onRequiresPrecheckin;

  const eventId = event?.id ?? '';
  const eventLatitude = event?.latitude ?? null;
  const eventLongitude = event?.longitude ?? null;

  useEffect(() => {
    if (!enabled || !event?.event_date?.trim()) {
      return;
    }

    const intervalId = setInterval(() => {
      setWindowTick((value) => value + 1);
    }, 30_000);

    return () => clearInterval(intervalId);
  }, [enabled, event?.event_date]);

  const inGeofenceWindow = useMemo(
    () => isEventWithinGeofenceCheckinWindow(event?.event_date, geofenceHoursBefore),
    [event?.event_date, geofenceHoursBefore, windowTick]
  );

  const geofenceActive =
    enabled
    && Boolean(eventId && familyId)
    && inGeofenceWindow
    && eventHasGeofenceCoordinates({
      latitude: eventLatitude,
      longitude: eventLongitude,
    })
    && !hasFamilyGeoCheckinConfirmed;

  useEffect(() => {
    triggeredRef.current = false;
    precheckinPromptShownRef.current = false;
    pendingConfirmCoordsRef.current = null;
  }, [eventId, familyId]);

  const runConfirmFlow = useCallback(
    async (coords: GeoCoordinates) => {
      if (!event?.id || !familyId) {
        return;
      }

      pendingConfirmCoordsRef.current = coords;
      setLastCoordinates(coords);
      setStatus('syncing');
      setErrorMessage(null);

      if (!hasFamilyPreCheckin) {
        setStatus('idle');

        if (!precheckinPromptShownRef.current) {
          precheckinPromptShownRef.current = true;
          onRequiresPrecheckinRef.current?.();
        }

        return;
      }

      if (!isDeviceOnline()) {
        await enqueueGeoCheckinOperation({
          type: 'confirm',
          eventId: event.id,
          familyId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setStatus('syncing');
        return;
      }

      try {
        const result = await confirmGeoFamilyCheckinAtomic({
          eventId: event.id,
          familyId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        if (result.requires_precheckin) {
          setStatus('idle');

          if (!precheckinPromptShownRef.current) {
            precheckinPromptShownRef.current = true;
            onRequiresPrecheckinRef.current?.();
          }

          return;
        }

        if (!result.success) {
          throw new Error(result.message ?? 'Falha ao confirmar check-in.');
        }

        pendingConfirmCoordsRef.current = null;
        setStatus('confirmed');
        notifyGeoCheckinConfirmed(result.participant_names);
        await onConfirmedRef.current?.();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Não foi possível confirmar o check-in.';
        setErrorMessage(message);
        setStatus('error');
      }
    },
    [event?.id, familyId, hasFamilyPreCheckin]
  );

  const runConfirmFlowRef = useRef(runConfirmFlow);
  runConfirmFlowRef.current = runConfirmFlow;

  useEffect(() => {
    if (hasFamilyPreCheckin) {
      precheckinPromptShownRef.current = false;
    }

    if (!hasFamilyPreCheckin || hasFamilyGeoCheckinConfirmed) {
      return;
    }

    const pendingCoords = pendingConfirmCoordsRef.current;

    if (pendingCoords && triggeredRef.current) {
      void runConfirmFlowRef.current(pendingCoords);
      return;
    }

    triggeredRef.current = false;
  }, [hasFamilyPreCheckin, hasFamilyGeoCheckinConfirmed]);

  const flushProximityUi = useCallback((force = false) => {
    const snapshot = proximityUiRef.current;
    const now = Date.now();

    if (!force && snapshot.lastEmitAt > 0 && now - snapshot.lastEmitAt < PROXIMITY_UI_THROTTLE_MS) {
      return;
    }

    snapshot.lastEmitAt = now;
    setLastDistanceMeters(snapshot.distanceMeters);
    setLastGpsAccuracyMeters(snapshot.accuracyMeters);
    setGpsProgress({ current: snapshot.progressCurrent, required: snapshot.progressRequired });
  }, []);

  useEffect(() => {
    const detachOnline = attachGeoCheckinOnlineSync(async (item) => {
      const ok = await processQueueItem(item);

      if (ok && event?.id && item.eventId === event.id) {
        setStatus('confirmed');
        await onConfirmedRef.current?.();
      }

      return ok;
    });

    void drainGeoCheckinQueue(processQueueItem);

    return detachOnline;
  }, [event?.id]);

  useEffect(() => {
    if (!geofenceActive || triggeredRef.current || precheckinPromptShownRef.current) {
      if (!geofenceActive) {
        stopWatchRef.current?.();
        stopWatchRef.current = null;
        setStatus((current) => (current === 'detecting' ? 'idle' : current));
      }

      return;
    }

    let cancelled = false;

    void (async () => {
      const permission = await requestDeviceGeolocationPermission();

      if (cancelled) {
        return;
      }

      if (permission !== 'granted') {
        setErrorMessage(formatDeviceGeolocationPermissionError(permission));
        setStatus('error');
        return;
      }

      setStatus('detecting');
      setErrorMessage(null);
      proximityUiRef.current = {
        lastEmitAt: 0,
        distanceMeters: null,
        accuracyMeters: null,
        progressCurrent: 0,
        progressRequired: 3,
      };
      setGpsProgress({ current: 0, required: 3 });
      setLastDistanceMeters(null);
      setLastGpsAccuracyMeters(null);

      stopWatchRef.current = startGeofenceValidationWatch({
        event: {
          latitude: eventLatitude,
          longitude: eventLongitude,
        },
        radiusMeters: geofenceRadiusMeters,
        onProgress: (current, required) => {
          if (cancelled) {
            return;
          }

          proximityUiRef.current.progressCurrent = current;
          proximityUiRef.current.progressRequired = required;
          flushProximityUi();
        },
        onProximity: (distanceMeters, accuracyMeters) => {
          if (cancelled) {
            return;
          }

          proximityUiRef.current.distanceMeters = distanceMeters;
          proximityUiRef.current.accuracyMeters = accuracyMeters;
          flushProximityUi();
        },
        onValidated: (coords) => {
          if (cancelled || triggeredRef.current) {
            return;
          }

          triggeredRef.current = true;
          pendingConfirmCoordsRef.current = coords;
          stopWatchRef.current?.();
          stopWatchRef.current = null;
          flushProximityUi(true);
          void runConfirmFlowRef.current(coords);
        },
        onError: (message) => {
          if (!cancelled) {
            stopWatchRef.current?.();
            stopWatchRef.current = null;
            triggeredRef.current = false;
            setErrorMessage(message);
            setStatus('error');
          }
        },
      });
    })();

    return () => {
      cancelled = true;
      stopWatchRef.current?.();
      stopWatchRef.current = null;
    };
  }, [
    eventLatitude,
    eventLongitude,
    flushProximityUi,
    geofenceActive,
    geofenceRadiusMeters,
    hasFamilyPreCheckin,
  ]);

  useEffect(() => {
    if (status !== 'syncing' || !isDeviceOnline()) {
      return;
    }

    void drainGeoCheckinQueue(async (item) => {
      const ok = await processQueueItem(item);

      if (ok) {
        setStatus('confirmed');
        await onConfirmedRef.current?.();
      }

      return ok;
    });
  }, [status]);

  return {
    status,
    gpsProgress,
    lastCoordinates,
    lastDistanceMeters,
    lastGpsAccuracyMeters,
    errorMessage,
    geofenceActive,
    inGeofenceWindow,
    isSyncing: status === 'syncing',
    isDetected: status === 'detecting' || status === 'syncing',
    isConfirmed: status === 'confirmed',
  };
};
