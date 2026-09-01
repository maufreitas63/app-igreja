/**
 * Valida a matemática do geofence (Haversine, raio, janela e 3 leituras).
 * Uso: node scripts/test-geofence-checkin.mjs
 */

const GEOFENCE_RADIUS_METERS = 30;
const REQUIRED_CONSECUTIVE_GPS_READINGS = 3;
const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg) => (deg * Math.PI) / 180;

const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(a));
};

const isInsideGeofence = (device, event, radiusMeters = GEOFENCE_RADIUS_METERS) =>
  haversineDistanceMeters(device.latitude, device.longitude, event.latitude, event.longitude)
  <= radiusMeters;

const parseGeofenceHoursBeforeParameter = (value) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const samePoint = { latitude: -23.5992715, longitude: -45.342999 };
const twentyFiveMetersNorth = { latitude: -23.5990468, longitude: -45.342999 };
const twoHundredMetersNorth = { latitude: -23.59747, longitude: -45.342999 };

assert(haversineDistanceMeters(samePoint.latitude, samePoint.longitude, samePoint.latitude, samePoint.longitude) === 0, 'mesmo ponto deve ser 0 m');

const aboutTwentyFive = haversineDistanceMeters(
  samePoint.latitude,
  samePoint.longitude,
  twentyFiveMetersNorth.latitude,
  twentyFiveMetersNorth.longitude
);
assert(aboutTwentyFive > 23 && aboutTwentyFive < 27, `esperava ~25 m, veio ${aboutTwentyFive}`);

assert(isInsideGeofence(samePoint, samePoint), 'no local deve estar dentro do raio');
assert(isInsideGeofence(twentyFiveMetersNorth, samePoint), '25 m deve estar dentro do raio');
assert(!isInsideGeofence(twoHundredMetersNorth, samePoint), '200 m deve ficar fora do raio');

let consecutive = 0;
for (const reading of [twentyFiveMetersNorth, twentyFiveMetersNorth, twoHundredMetersNorth, twentyFiveMetersNorth, twentyFiveMetersNorth, twentyFiveMetersNorth]) {
  consecutive = isInsideGeofence(reading, samePoint) ? consecutive + 1 : 0;
}
assert(consecutive === REQUIRED_CONSECUTIVE_GPS_READINGS, `3 leituras consecutivas no raio; veio ${consecutive}`);

assert(parseGeofenceHoursBeforeParameter('2') === 2, 'tempo 2 horas');
assert(parseGeofenceHoursBeforeParameter('abc') === 0, 'tempo inválido vira 0');
assert(parseGeofenceHoursBeforeParameter(null) === 0, 'tempo vazio vira 0');

console.log('geofence check-in: ok');
