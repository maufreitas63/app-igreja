import {
  GPS_READING_INTERVAL_MS,
  type GeoCoordinates,
  createGeoReadingValidator,
  eventHasGeofenceCoordinates,
  REQUIRED_CONSECUTIVE_GPS_READINGS,
} from '@/lib/checkinGeofence';
import { Platform } from 'react-native';

export type DeviceGeolocationPermission = 'granted' | 'denied' | 'unavailable';

export const requestDeviceGeolocationPermission = async (): Promise<DeviceGeolocationPermission> => {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return 'unavailable';
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve('denied');
            return;
          }

          resolve('unavailable');
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 }
      );
    });
  }

  const Location = await import('expo-location');
  const current = await Location.getForegroundPermissionsAsync();

  if (current.status === Location.PermissionStatus.GRANTED) {
    return 'granted';
  }

  const requested = await Location.requestForegroundPermissionsAsync();

  if (requested.status === Location.PermissionStatus.GRANTED) {
    return 'granted';
  }

  if (requested.status === Location.PermissionStatus.DENIED) {
    return 'denied';
  }

  return 'unavailable';
};

export const readDeviceGeolocationOnce = async (): Promise<GeoCoordinates | null> => {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 }
      );
    });
  }

  const Location = await import('expo-location');
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
};

export type GeoWatchOptions = {
  event: { latitude?: number | null; longitude?: number | null };
  onValidated: (coords: GeoCoordinates) => void;
  onProgress?: (consecutiveInside: number, required: number) => void;
  onError?: (message: string) => void;
  intervalMs?: number;
};

export const startGeofenceValidationWatch = (options: GeoWatchOptions) => {
  if (!eventHasGeofenceCoordinates(options.event)) {
    return () => undefined;
  }

  const eventCoords = {
    latitude: options.event.latitude as number,
    longitude: options.event.longitude as number,
  };

  const validator = createGeoReadingValidator();
  let cancelled = false;
  let timerId: ReturnType<typeof setInterval> | null = null;

  const tick = async () => {
    if (cancelled) {
      return;
    }

    const reading = await readDeviceGeolocationOnce();

    if (!reading) {
      options.onError?.('Não foi possível obter a localização do dispositivo.');
      return;
    }

    const state = validator.pushReading(reading, eventCoords);
    options.onProgress?.(state.consecutiveInsideCount, REQUIRED_CONSECUTIVE_GPS_READINGS);

    if (validator.isValidated()) {
      options.onValidated(reading);
      stop();
    }
  };

  const stop = () => {
    cancelled = true;

    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  void tick();
  timerId = setInterval(() => {
    void tick();
  }, options.intervalMs ?? GPS_READING_INTERVAL_MS);

  return stop;
};
