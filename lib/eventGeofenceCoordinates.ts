import type { EventFavoriteLocation } from '@/lib/eventFavoriteLocationsApi';
import {
  DEFAULT_EVENT_GEOFENCE_RADIUS_METERS,
  type GeoCoordinates,
} from '@/lib/checkinGeofence';
import { normalizeLocationKey } from '@/lib/locationKey';

const hasValidCoordinates = (location: Pick<EventFavoriteLocation, 'latitude' | 'longitude'>) => {
  const lat = location.latitude;
  const lng = location.longitude;

  return (
    typeof lat === 'number'
    && Number.isFinite(lat)
    && typeof lng === 'number'
    && Number.isFinite(lng)
  );
};

export type EventGeofenceMatch = {
  coordinates: GeoCoordinates;
  radiusMeters: number;
};

/** Vincula `events.event_local` ao registro em `event_favorite_locations.name`. */
export const resolveEventGeofence = (
  eventLocal: string | null | undefined,
  locations: ReadonlyArray<
    Pick<
      EventFavoriteLocation,
      'name' | 'latitude' | 'longitude' | 'is_active' | 'sort_order' | 'geofence_radius_meters'
    >
  >
): EventGeofenceMatch | null => {
  const key = normalizeLocationKey(eventLocal);

  if (!key) {
    return null;
  }

  const match = [...locations]
    .filter((location) => {
      if (location.is_active === false) {
        return false;
      }

      if (normalizeLocationKey(location.name) !== key) {
        return false;
      }

      return hasValidCoordinates(location);
    })
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))[0];

  if (!match || match.latitude === null || match.longitude === null) {
    return null;
  }

  const radius = match.geofence_radius_meters;

  return {
    coordinates: {
      latitude: match.latitude,
      longitude: match.longitude,
    },
    radiusMeters:
      typeof radius === 'number' && Number.isFinite(radius) && radius > 0
        ? radius
        : DEFAULT_EVENT_GEOFENCE_RADIUS_METERS,
  };
};

export const resolveEventGeofenceCoordinates = (
  eventLocal: string | null | undefined,
  locations: ReadonlyArray<
    Pick<
      EventFavoriteLocation,
      'name' | 'latitude' | 'longitude' | 'is_active' | 'sort_order' | 'geofence_radius_meters'
    >
  >
): GeoCoordinates | null => resolveEventGeofence(eventLocal, locations)?.coordinates ?? null;
