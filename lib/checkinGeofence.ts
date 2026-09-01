/** Raio padrão do geofence (metros) — espelha `geo_checkin_radius_meters()` no Supabase. */
export const GEOFENCE_RADIUS_METERS = 30;

/** Leituras GPS consecutivas dentro do raio antes de disparar o check-in. */
export const REQUIRED_CONSECUTIVE_GPS_READINGS = 3;

/** Intervalo mínimo entre leituras GPS (ms). */
export const GPS_READING_INTERVAL_MS = 2000;

/** Margem máxima de imprecisão do GPS somada ao raio (metros). */
export const MAX_GEOFENCE_ACCURACY_BUFFER_METERS = 50;

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

export const haversineDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return earthRadiusM * 2 * Math.asin(Math.sqrt(a));
};

export const isInsideGeofence = (
  device: GeoCoordinates,
  event: GeoCoordinates,
  radiusMeters = GEOFENCE_RADIUS_METERS
) =>
  haversineDistanceMeters(
    device.latitude,
    device.longitude,
    event.latitude,
    event.longitude
  ) <= radiusMeters;

export const distanceToGeofenceMeters = (
  device: GeoCoordinates,
  event: GeoCoordinates
) =>
  haversineDistanceMeters(
    device.latitude,
    device.longitude,
    event.latitude,
    event.longitude
  );

export const isInsideGeofenceWithAccuracy = (
  device: GeoCoordinates,
  event: GeoCoordinates,
  radiusMeters = GEOFENCE_RADIUS_METERS
) => {
  const distance = distanceToGeofenceMeters(device, event);
  const accuracyBuffer = Math.min(
    Math.max(device.accuracy ?? 0, 0),
    MAX_GEOFENCE_ACCURACY_BUFFER_METERS
  );

  return distance <= radiusMeters + accuracyBuffer;
};

export const parseGeofenceRadiusMeters = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return GEOFENCE_RADIUS_METERS;
  }

  const parsed = Number.parseFloat(trimmed);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : GEOFENCE_RADIUS_METERS;
};

export const formatGeoDistanceMeters = (distanceMeters: number | null | undefined) => {
  if (distanceMeters === null || distanceMeters === undefined || !Number.isFinite(distanceMeters)) {
    return null;
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

export type GeoReadingValidatorState = {
  consecutiveInsideCount: number;
  lastReading: GeoCoordinates | null;
  distanceMeters: number | null;
};

export const createGeoReadingValidator = () => {
  let consecutiveInsideCount = 0;
  let lastReading: GeoCoordinates | null = null;
  let distanceMeters: number | null = null;

  const reset = () => {
    consecutiveInsideCount = 0;
    lastReading = null;
    distanceMeters = null;
  };

  const pushReading = (
    device: GeoCoordinates,
    event: GeoCoordinates,
    radiusMeters = GEOFENCE_RADIUS_METERS
  ): GeoReadingValidatorState => {
    lastReading = device;
    distanceMeters = distanceToGeofenceMeters(device, event);

    // O servidor valida o raio sem margem de GPS; só dispara com distância real no raio.
    if (isInsideGeofence(device, event, radiusMeters)) {
      consecutiveInsideCount += 1;
    } else {
      consecutiveInsideCount = 0;
    }

    return { consecutiveInsideCount, lastReading, distanceMeters };
  };

  const isValidated = () => consecutiveInsideCount >= REQUIRED_CONSECUTIVE_GPS_READINGS;

  const getState = (): GeoReadingValidatorState => ({
    consecutiveInsideCount,
    lastReading,
    distanceMeters,
  });

  return { pushReading, reset, isValidated, getState };
};

export const eventHasGeofenceCoordinates = (event: {
  latitude?: number | null;
  longitude?: number | null;
}) => {
  const lat = event.latitude;
  const lng = event.longitude;

  return (
    typeof lat === 'number'
    && Number.isFinite(lat)
    && typeof lng === 'number'
    && Number.isFinite(lng)
  );
};
