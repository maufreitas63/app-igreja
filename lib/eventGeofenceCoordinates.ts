import type { EventFavoriteLocation } from '@/lib/eventFavoriteLocationsApi';
import type { GeoCoordinates } from '@/lib/checkinGeofence';

const normalizeLocationKey = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Vincula `events.event_local` ao registro em `event_favorite_locations.name`. */
export const resolveEventGeofenceCoordinates = (
  eventLocal: string | null | undefined,
  locations: ReadonlyArray<Pick<EventFavoriteLocation, 'name' | 'latitude' | 'longitude' | 'is_active'>>
): GeoCoordinates | null => {
  const key = normalizeLocationKey(eventLocal);

  if (!key) {
    return null;
  }

  const match = locations.find((location) => {
    if (location.is_active === false) {
      return false;
    }

    if (normalizeLocationKey(location.name) !== key) {
      return false;
    }

    const lat = location.latitude;
    const lng = location.longitude;

    return (
      typeof lat === 'number'
      && Number.isFinite(lat)
      && typeof lng === 'number'
      && Number.isFinite(lng)
    );
  });

  if (!match || match.latitude === null || match.longitude === null) {
    return null;
  }

  return {
    latitude: match.latitude,
    longitude: match.longitude,
  };
};
