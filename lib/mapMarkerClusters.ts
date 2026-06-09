import type { LatLng } from '@/lib/geoMapGeocoding';
import type { MapMarker } from '@/lib/profilesMapMarkersTypes';

const EARTH_RADIUS_KM = 6371;

export const haversineKm = (left: LatLng, right: LatLng) => {
  const lat1 = (left.lat * Math.PI) / 180;
  const lat2 = (right.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((right.lng - left.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

const medianCoord = (markers: MapMarker[]): LatLng => {
  const sortedLat = [...markers].sort((left, right) => left.coord.lat - right.coord.lat);
  const sortedLng = [...markers].sort((left, right) => left.coord.lng - right.coord.lng);
  const mid = Math.floor(sortedLat.length / 2);

  return {
    lat: sortedLat[mid]?.coord.lat ?? 0,
    lng: sortedLng[mid]?.coord.lng ?? 0,
  };
};

/** Separa pins da região principal (ex.: Caraguatatuba) de outliers por geocodificação errada. */
export const splitMapMarkersByCluster = (
  markers: MapMarker[],
  maxKmFromMedian = 35
): { focus: MapMarker[]; distant: MapMarker[] } => {
  if (markers.length <= 2) {
    return { focus: markers, distant: [] };
  }

  const center = medianCoord(markers);
  const focus: MapMarker[] = [];
  const distant: MapMarker[] = [];

  for (const marker of markers) {
    if (haversineKm(marker.coord, center) > maxKmFromMedian) {
      distant.push(marker);
      continue;
    }

    focus.push(marker);
  }

  if (!focus.length) {
    return { focus: markers, distant: [] };
  }

  return { focus, distant };
};

export const countMarkersSharingCep = (markers: MapMarker[]) => {
  const byCep = new Map<string, number>();

  for (const marker of markers) {
    byCep.set(marker.cepDigits, (byCep.get(marker.cepDigits) ?? 0) + 1);
  }

  return Array.from(byCep.values()).filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
};
