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
        timeout: 20_000,
        maximumAge: 120_000,
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

  const attempt = (enableHighAccuracy: boolean) =>
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
          timeout: enableHighAccuracy ? 20_000 : 25_000,
          maximumAge: 0,
        }
      );
    });

  const highAccuracy = await attempt(true);

  if (highAccuracy) {
    return highAccuracy;
  }

  return attempt(false);
};

export const readDeviceGeolocationOnce = async (): Promise<GeoCoordinates | null> => {
  if (Platform.OS === 'web') {
    return readWebGeolocationOnce();
  }

  try {
    const Location = await import('expo-location');
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch {
    try {
      const Location = await import('expo-location');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch {
      return null;
    }
  }
};

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

  const validator = createGeoReadingValidator();
  let cancelled = false;
  let consecutiveReadFailures = 0;
  let lastTickAt = 0;
  const minTickGapMs = options.intervalMs ?? GPS_READING_INTERVAL_MS;

  const handleReading = (reading: GeoCoordinates | null) => {
    if (cancelled) {
      return;
    }

    const now = Date.now();

    if (now - lastTickAt < minTickGapMs) {
      return;
    }

    lastTickAt = now;

    if (!reading) {
      consecutiveReadFailures += 1;

      if (consecutiveReadFailures >= 3) {
        options.onError?.(
          Platform.OS === 'web'
            ? 'Não foi possível obter sua localização. Verifique a permissão do site e se o Windows/macOS permite localização para o navegador.'
            : 'Não foi possível obter a localização do dispositivo. Verifique o GPS e tente novamente.'
        );
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

  let webWatchId: number | null = null;
  let nativeSubscription: { remove: () => void } | null = null;
  let pollTimerId: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    cancelled = true;

    if (webWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(webWatchId);
      webWatchId = null;
    }

    nativeSubscription?.remove();
    nativeSubscription = null;

    if (pollTimerId) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  };

  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      options.onError?.('Geolocalização não suportada neste navegador.');
      return stop;
    }

    webWatchId = navigator.geolocation.watchPosition(
      (position) => {
        handleReading({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          options.onError?.(formatDeviceGeolocationPermissionError('denied'));
          stop();
          return;
        }

        handleReading(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 25_000,
      }
    );

    return stop;
  }

  void (async () => {
    try {
      const Location = await import('expo-location');
      nativeSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: minTickGapMs,
        },
        (position) => {
          handleReading({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        }
      );
    } catch {
      pollTimerId = setInterval(() => {
        void readDeviceGeolocationOnce().then(handleReading);
      }, minTickGapMs);

      void readDeviceGeolocationOnce().then(handleReading);
    }
  })();

  return stop;
};
