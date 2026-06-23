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
  requestDeviceGeolocationPermission,
  startGeofenceValidationWatch,
} from '@/lib/deviceGeolocation';
import { isEventWithinGeofenceCheckinWindow, normalizeAppParameterValue } from '@/lib/checkInVisibility';

export type GeoCheckinUiStatus = 'idle' | 'detecting' | 'syncing' | 'confirmed' | 'error';

export type GeoCheckinEvent = {
  id: string;
  event_date: string | null | undefined;
  latitude?: number | null;
  longitude?: number | null;
};

export type UseGeoCheckinMonitorOptions = {
  enabled: boolean;
  geofenceParameterValue: string | null | undefined;
  geofenceHoursBefore: number;
  event: GeoCheckinEvent | null | undefined;
  familyId: string | undefined;
  hasFamilyPreCheckin: boolean;
  hasFamilyGeoCheckinConfirmed?: boolean;
  onRequiresPrecheckin?: () => void;
  onConfirmed?: () => void | Promise<void>;
};

const isGeofenceFeatureEnabled = (value: string | null | undefined) =>
  normalizeAppParameterValue(value) === 'sim';

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
  geofenceParameterValue,
  geofenceHoursBefore,
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
  const stopWatchRef = useRef<(() => void) | null>(null);
  const triggeredRef = useRef(false);
  const [windowTick, setWindowTick] = useState(0);

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
    && isGeofenceFeatureEnabled(geofenceParameterValue)
    && Boolean(event?.id && familyId)
    && inGeofenceWindow
    && eventHasGeofenceCoordinates(event ?? {})
    && !hasFamilyGeoCheckinConfirmed;

  const runConfirmFlow = useCallback(
    async (coords: GeoCoordinates) => {
      if (!event?.id || !familyId) {
        return;
      }

      setLastCoordinates(coords);
      setStatus('syncing');
      setErrorMessage(null);

      if (!hasFamilyPreCheckin) {
        setStatus('idle');
        onRequiresPrecheckin?.();
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
          onRequiresPrecheckin?.();
          return;
        }

        if (!result.success) {
          throw new Error(result.message ?? 'Falha ao confirmar check-in.');
        }

        setStatus('confirmed');
        notifyGeoCheckinConfirmed(result.participant_names);
        await onConfirmed?.();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Não foi possível confirmar o check-in.';
        setErrorMessage(message);
        setStatus('error');
      }
    },
    [event?.id, familyId, hasFamilyPreCheckin, onConfirmed, onRequiresPrecheckin]
  );

  useEffect(() => {
    const detachOnline = attachGeoCheckinOnlineSync(async (item) => {
      const ok = await processQueueItem(item);

      if (ok && event?.id && item.eventId === event.id) {
        setStatus('confirmed');
        await onConfirmed?.();
      }

      return ok;
    });

    void drainGeoCheckinQueue(processQueueItem);

    return detachOnline;
  }, [event?.id, onConfirmed]);

  useEffect(() => {
    triggeredRef.current = false;
    setStatus('idle');
    setGpsProgress({ current: 0, required: 3 });
    setErrorMessage(null);

    stopWatchRef.current?.();
    stopWatchRef.current = null;

    if (!geofenceActive) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const permission = await requestDeviceGeolocationPermission();

      if (cancelled) {
        return;
      }

      if (permission !== 'granted') {
        setErrorMessage('Permissão de localização negada para check-in automático.');
        setStatus('error');
        return;
      }

      setStatus('detecting');

      stopWatchRef.current = startGeofenceValidationWatch({
        event: event ?? {},
        onProgress: (current, required) => {
          if (!cancelled) {
            setGpsProgress({ current, required });
          }
        },
        onValidated: (coords) => {
          if (cancelled || triggeredRef.current) {
            return;
          }

          triggeredRef.current = true;
          void runConfirmFlow(coords);
        },
        onError: (message) => {
          if (!cancelled) {
            setErrorMessage(message);
          }
        },
      });
    })();

    return () => {
      cancelled = true;
      stopWatchRef.current?.();
      stopWatchRef.current = null;
    };
  }, [event, familyId, geofenceActive, geofenceHoursBefore, runConfirmFlow]);

  useEffect(() => {
    if (status !== 'syncing' || !isDeviceOnline()) {
      return;
    }

    void drainGeoCheckinQueue(async (item) => {
      const ok = await processQueueItem(item);

      if (ok) {
        setStatus('confirmed');
        await onConfirmed?.();
      }

      return ok;
    });
  }, [status, onConfirmed]);

  return {
    status,
    gpsProgress,
    lastCoordinates,
    errorMessage,
    geofenceActive,
    inGeofenceWindow,
    isSyncing: status === 'syncing',
    isDetected: status === 'detecting' || status === 'syncing',
    isConfirmed: status === 'confirmed',
  };
};
