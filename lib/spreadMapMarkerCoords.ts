import type { LatLng } from '@/lib/geoMapGeocoding';
import type { MapMarker } from '@/lib/profilesMapMarkersTypes';

const COORD_GROUP_PRECISION = 4;
const BASE_OFFSET_METERS = 55;
const MARKERS_PER_RING = 8;

const coordGroupKey = (coord: LatLng) =>
  `${coord.lat.toFixed(COORD_GROUP_PRECISION)}|${coord.lng.toFixed(COORD_GROUP_PRECISION)}`;

/** Desloca pins no mesmo ponto para todos ficarem visíveis no mapa. */
export const offsetCoordForPinIndex = (
  coord: LatLng,
  index: number,
  total: number
): LatLng => {
  if (total <= 1) {
    return coord;
  }

  const ring = Math.floor(index / MARKERS_PER_RING) + 1;
  const indexInRing = index % MARKERS_PER_RING;
  const angle = (indexInRing / MARKERS_PER_RING) * Math.PI * 2 + (ring % 2) * (Math.PI / MARKERS_PER_RING);
  const meters = BASE_OFFSET_METERS * ring;
  const latRadians = (coord.lat * Math.PI) / 180;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = Math.max(metersPerDegreeLat * Math.cos(latRadians), 1);

  return {
    lat: coord.lat + (meters / metersPerDegreeLat) * Math.sin(angle),
    lng: coord.lng + (meters / metersPerDegreeLng) * Math.cos(angle),
  };
};

export const spreadMapMarkersAtSameCoord = (markers: MapMarker[]): MapMarker[] => {
  const groups = new Map<string, MapMarker[]>();

  for (const marker of markers) {
    const key = coordGroupKey(marker.coord);
    const bucket = groups.get(key);

    if (bucket) {
      bucket.push(marker);
      continue;
    }

    groups.set(key, [marker]);
  }

  const spread: MapMarker[] = [];

  for (const group of groups.values()) {
    group.forEach((marker, index) => {
      spread.push({
        ...marker,
        coord: offsetCoordForPinIndex(marker.coord, index, group.length),
      });
    });
  }

  return spread;
};
