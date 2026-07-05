import {
  GEOFENCE_RADIUS_METERS,
  GPS_READING_INTERVAL_MS,
  type GeoCoordinates,
  createGeoReadingValidator,
  eventHasGeofenceCoordinates,
  REQUIRED_CONSECUTIVE_GPS_READINGS,
} from '@/lib/checkinGeofence';
import { Platform } from 'react-native';

export type DeviceGeolocationPermission = 'granted' | 'denied' | 'unavailable';

export const formatDeviceGeolocationPermissionError = (
  permission: Exclude<DeviceGeolocationPermission, 'granted'>
) => {
  if (permission === 'denied') {
    return Platform.OS === 'web'
      ? 'Permissão de localização bloqueada no navegador. Clique no cadeado da barra de endereços e permita a localização para este site.'
      : 'Permissão de localização negada para check-in automático. Habilite nas configurações do aparelho.';
  }

  return Platform.OS === 'web'
    ? 'Não foi possível acessar a localização neste navegador. Use HTTPS, permita a localização e verifique se o serviço está ativo no sistema.'
    : 'Serviço de localização indisponível no dispositivo.';
};

const queryWebGeolocationPermissionState = async (): Promise<PermissionState | null> => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return null;
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return null;
  }
};

const probeWebGeolocationAccess = async (): Promise<DeviceGeolocationPermission> => {
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

        resolve('granted');
      },
      {
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 60_000,
      }
    );
  });
};

export const requestDeviceGeolocationPermission = async (): Promise<DeviceGeolocationPermission> => {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return 'unavailable';
    }

    if (!window.isSecureContext) {
      return 'unavailable';
    }

    const permissionState = await queryWebGeolocationPermissionState();

    if (permissionState === 'granted') {
      return 'granted';
    }

    if (permissionState === 'denied') {
      return 'denied';
    }

    return probeWebGeolocationAccess();
  }

  const Location = await import('expo-location');

  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return 'unavailable';
  }

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

const readWebGeolocationOnce = async (): Promise<GeoCoordinates | null> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  const attempt = (enableHighAccuracy: boolean, maximumAge: number) =>
    new Promise<GeoCoordinates | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy,
          timeout: 15_000,
          maximumAge,
        }
      );
    });

  const freshLowAccuracy = await attempt(false, 0);

  if (freshLowAccuracy) {
    return freshLowAccuracy;
  }

  const freshHighAccuracy = await attempt(true, 0);

  if (freshHighAccuracy) {
    return freshHighAccuracy;
  }

  return attempt(false, 120_000);
};

const readNativeGeolocationOnce = async (): Promise<GeoCoordinates | null> => {
  const Location = await import('expo-location');

  try {
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 120_000,
      requiredAccuracy: 250,
    });

    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        accuracy: lastKnown.coords.accuracy,
      };
    }
  } catch {
    // segue para leitura ativa
  }

  const accuracyLevels = [
    Location.Accuracy.Balanced,
    Location.Accuracy.High,
    Location.Accuracy.Low,
  ];

  for (const accuracy of accuracyLevels) {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch {
      continue;
    }
  }

  return null;
};

export const readDeviceGeolocationOnce = async (): Promise<GeoCoordinates | null> => {
  if (Platform.OS === 'web') {
    return readWebGeolocationOnce();
  }

  return readNativeGeolocationOnce();
};

/** Leitura única com máxima precisão disponível (GPS do aparelho). */
export const readPreciseDeviceGeolocation = async (): Promise<GeoCoordinates | null> => {
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
        {
          enableHighAccuracy: true,
          timeout: 30_000,
          maximumAge: 0,
        }
      );
    });
  }

  const Location = await import('expo-location');
  const accuracyLevels = [
    Location.Accuracy.BestForNavigation,
    Location.Accuracy.Highest,
    Location.Accuracy.High,
  ];

  for (const accuracy of accuracyLevels) {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch {
      continue;
    }
  }

  return null;
};

export const formatGeolocationCoordinate = (value: number) => value.toFixed(7);

export type GeoWatchOptions = {
  event: { latitude?: number | null; longitude?: number | null };
  radiusMeters?: number;
  onValidated: (coords: GeoCoordinates) => void;
  onProgress?: (consecutiveInside: number, required: number) => void;
  onProximity?: (distanceMeters: number | null, accuracyMeters: number | null) => void;
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
  const radiusMeters = options.radiusMeters ?? GEOFENCE_RADIUS_METERS;
  const pollIntervalMs = options.intervalMs ?? GPS_READING_INTERVAL_MS;

  const validator = createGeoReadingValidator();
  let stopped = false;
  let inFlight = false;
  let consecutiveReadFailures = 0;
  let pollTimerId: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    stopped = true;

    if (pollTimerId) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  };

  const handleReading = (reading: GeoCoordinates | null) => {
    if (stopped) {
      return;
    }

    if (!reading) {
      consecutiveReadFailures += 1;

      if (consecutiveReadFailures >= 3) {
        options.onError?.(
          Platform.OS === 'web'
            ? 'Não foi possível obter sua localização. Verifique a permissão do site e se o Windows/macOS permite localização para o navegador.'
            : 'Não foi possível obter a localização do dispositivo. Verifique o GPS e tente novamente.'
        );
        stop();
      }

      return;
    }

    consecutiveReadFailures = 0;

    const state = validator.pushReading(reading, eventCoords, radiusMeters);
    options.onProximity?.(state.distanceMeters, reading.accuracy ?? null);
    options.onProgress?.(state.consecutiveInsideCount, REQUIRED_CONSECUTIVE_GPS_READINGS);

    if (validator.isValidated()) {
      options.onValidated(reading);
      stop();
    }
  };

  const poll = async () => {
    if (stopped || inFlight) {
      return;
    }

    inFlight = true;

    try {
      const reading = await readDeviceGeolocationOnce();
      handleReading(reading);
    } finally {
      inFlight = false;
    }
  };

  void poll();
  pollTimerId = setInterval(() => {
    void poll();
  }, pollIntervalMs);

  return stop;
};
