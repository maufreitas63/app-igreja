import {
  fetchCepGeolocationRecordsByDigits,
  fetchCepGeolocationsSyncFingerprint,
  isLowTrustGeocodeSource,
  resolveAndUpsertCepGeolocation,
} from '@/lib/cepGeolocationApi';
import { shouldClientGeocodeCep } from '@/lib/geocodingPolicy';
import { enrichProfilesMapAddresses } from '@/lib/enrichProfileMapAddress';
import {
  isCoordPlausibleForProfile,
  isDegenerateMapCoord,
  LatLng,
  normalizeCepDigits,
} from '@/lib/geoMapGeocoding';

const isServerTableCoord = (coord: LatLng | undefined): coord is LatLng => {
  if (!coord) {
    return false;
  }

  return !Number.isNaN(coord.lat) && !Number.isNaN(coord.lng);
};
import {
  attachMapAclToProfiles,
  fetchProfilesAclSyncFingerprint,
  fetchProfilesMapAclInfo,
} from '@/lib/profileMapAcl';
import {
  readCepCoordCache,
  readProfilesMapSnapshot,
  writeCepCoordCache,
  writeProfilesMapSnapshot,
  type ProfilesMapSnapshot,
} from '@/lib/profilesMapCache';
import type { MapMarker, ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import { spreadMapMarkersAtSameCoord } from '@/lib/spreadMapMarkerCoords';
import { supabase } from '@/lib/supabase';

export type { ProfileForMap, MapMarker } from '@/lib/profilesMapMarkersTypes';

export type SyncProfilesMapMarkersResult = {
  profiles: ProfileForMap[];
  cepToCoord: Record<string, LatLng>;
  invalidCepCount: number;
  profilesWithoutCepCount: number;
  markers: MapMarker[];
  mapCenter: { latitude: number; longitude: number };
  fromCache: boolean;
};

let inFlightSync: Promise<SyncProfilesMapMarkersResult> | null = null;

const coordCacheKey = (coord: LatLng) => `${coord.lat.toFixed(5)}|${coord.lng.toFixed(5)}`;

const findCepsSharingCachedCoord = (cache: Record<string, LatLng>) => {
  const byCoord = new Map<string, string[]>();

  for (const [cepDigits, coord] of Object.entries(cache)) {
    const bucket = byCoord.get(coordCacheKey(coord)) ?? [];
    bucket.push(cepDigits);
    byCoord.set(coordCacheKey(coord), bucket);
  }

  const shared = new Set<string>();
  for (const ceps of byCoord.values()) {
    if (ceps.length > 1) {
      ceps.forEach((cep) => shared.add(cep));
    }
  }

  return shared;
};

const isCacheCoordUsable = (
  cepDigits: string,
  coord: LatLng | undefined,
  sharedCoordCeps: Set<string>
) => {
  if (!coord) {
    return false;
  }

  if (isDegenerateMapCoord(coord)) {
    return false;
  }

  if (sharedCoordCeps.has(cepDigits)) {
    return false;
  }

  return true;
};

export const fetchProfilesMapSyncFingerprint = async (): Promise<string | null> => {
  const [countResult, latestResult, aclFingerprint, geoFingerprint] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    fetchProfilesAclSyncFingerprint(),
    fetchCepGeolocationsSyncFingerprint(),
  ]);

  if (countResult.error) {
    throw countResult.error;
  }

  if (latestResult.error) {
    throw latestResult.error;
  }

  const total = countResult.count ?? 0;
  const latestUpdatedAt = latestResult.data?.updated_at
    ? String(latestResult.data.updated_at)
    : 'none';

  return `${total}|${latestUpdatedAt}|acl:${aclFingerprint}|geo:${geoFingerprint ?? 'none'}`;
};

export const buildProfilesMapMarkers = (
  profiles: ProfileForMap[],
  cepToCoord: Record<string, LatLng>
): MapMarker[] => {
  const items: MapMarker[] = [];

  for (const profile of profiles) {
    const cepDigits = normalizeCepDigits(profile.cep);
    if (!cepDigits) {
      continue;
    }

    const coord = cepToCoord[cepDigits];
    if (!coord) {
      continue;
    }

    items.push({ profile, coord, cepDigits });
  }

  return spreadMapMarkersAtSameCoord(items);
};

const buildMapCenter = (markers: MapMarker[]) => {
  if (!markers.length) {
    return { latitude: -23.621, longitude: -45.59 };
  }

  const sum = markers.reduce(
    (acc, marker) => ({
      lat: acc.lat + marker.coord.lat,
      lng: acc.lng + marker.coord.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    latitude: sum.lat / markers.length,
    longitude: sum.lng / markers.length,
  };
};

export const hydrateProfilesMapSnapshot = (
  snapshot: ProfilesMapSnapshot
): SyncProfilesMapMarkersResult => {
  const markers = buildProfilesMapMarkers(snapshot.profiles, snapshot.cepToCoord);

  return {
    profiles: snapshot.profiles,
    cepToCoord: snapshot.cepToCoord,
    invalidCepCount: snapshot.invalidCepCount,
    profilesWithoutCepCount: snapshot.profilesWithoutCepCount,
    markers,
    mapCenter: buildMapCenter(markers),
    fromCache: true,
  };
};

const fetchAndBuildSnapshot = async (
  syncFingerprint: string,
  googleApiKey: string | undefined,
  options?: { force?: boolean }
): Promise<ProfilesMapSnapshot> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, nome_fantasia, phone, cep, address_street, address_number, address_neighborhood, address_city, address_state'
    )
    .order('full_name', { ascending: true });

  if (error) {
    throw error;
  }

  const rawProfiles = (data ?? []) as Array<Omit<ProfileForMap, 'isVisitantesOnly'> & { isVisitantesOnly?: boolean }>;
  const mapAclResult = await fetchProfilesMapAclInfo();
  const profilesList = attachMapAclToProfiles(
    rawProfiles.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      nome_fantasia: row.nome_fantasia,
      phone: row.phone,
      cep: row.cep,
      address_street: row.address_street,
      address_number: row.address_number,
      address_neighborhood: row.address_neighborhood,
      address_city: row.address_city,
      address_state: row.address_state,
    })),
    mapAclResult
  );
  const profilesByCep = new Map<string, ProfileForMap>();
  let withoutCep = 0;

  for (const profile of profilesList) {
    const cepDigits = normalizeCepDigits(profile.cep);
    if (!cepDigits) {
      withoutCep += 1;
      continue;
    }

    if (!profilesByCep.has(cepDigits)) {
      profilesByCep.set(cepDigits, profile);
    }
  }

  const cepDigitsList = [...profilesByCep.keys()];
  const cepRecords = await fetchCepGeolocationRecordsByDigits(cepDigitsList);
  const profilesWithAddress = enrichProfilesMapAddresses(profilesList, cepRecords);
  const serverCoords = Object.fromEntries(
    Object.entries(cepRecords).flatMap(([cepDigits, row]) => {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return [];
      }
      return [[cepDigits, { lat, lng }]];
    })
  );

  const cache = await readCepCoordCache();
  const nextCache: Record<string, LatLng> = { ...cache, ...serverCoords };
  const sharedCoordCeps = findCepsSharingCachedCoord(nextCache);
  const cepToCoord: Record<string, LatLng> = {};
  let invalidCount = 0;

  const profilesByCepEnriched = new Map<string, ProfileForMap>();
  for (const profile of profilesWithAddress) {
    const cepDigits = normalizeCepDigits(profile.cep);
    if (!cepDigits || profilesByCepEnriched.has(cepDigits)) {
      continue;
    }
    profilesByCepEnriched.set(cepDigits, profile);
  }

  for (const [cepDigits, sampleProfile] of profilesByCepEnriched.entries()) {
    const serverRecord = cepRecords[cepDigits];
    const serverCoord = serverCoords[cepDigits];
    const serverCoordIsTrusted =
      isServerTableCoord(serverCoord)
      && !isLowTrustGeocodeSource(serverRecord?.geocode_source);

    if (serverCoordIsTrusted && !options?.force) {
      cepToCoord[cepDigits] = serverCoord;
      nextCache[cepDigits] = serverCoord;
      continue;
    }

    const cachedCoord = nextCache[cepDigits];
    const cachedCoordIsValid =
      cachedCoord
      && isCoordPlausibleForProfile(cachedCoord, sampleProfile)
      && isCacheCoordUsable(cepDigits, cachedCoord, sharedCoordCeps);

    if (cachedCoordIsValid && !options?.force) {
      cepToCoord[cepDigits] = cachedCoord;
      continue;
    }

    if (cachedCoord && !cachedCoordIsValid) {
      delete nextCache[cepDigits];
    }

    let coord: LatLng | null = null;

    if (shouldClientGeocodeCep(serverCoordIsTrusted, Boolean(options?.force))) {
      try {
        coord = await resolveAndUpsertCepGeolocation({
          cepDigits,
          profile: sampleProfile,
          googleApiKey,
          source: 'app_map_sync',
        });
      } catch {
        coord = null;
      }
    }

    if (!coord) {
      invalidCount += 1;
      continue;
    }

    cepToCoord[cepDigits] = coord;
    nextCache[cepDigits] = coord;
  }

  await writeCepCoordCache(nextCache);

  return {
    version: 1,
    syncFingerprint,
    cachedAt: new Date().toISOString(),
    profiles: profilesWithAddress,
    cepToCoord,
    invalidCepCount: invalidCount,
    profilesWithoutCepCount: withoutCep,
  };
};

export const syncProfilesMapMarkers = async (options?: {
  force?: boolean;
  googleApiKey?: string;
}): Promise<SyncProfilesMapMarkersResult> => {
  if (inFlightSync && !options?.force) {
    return inFlightSync;
  }

  const run = async (): Promise<SyncProfilesMapMarkersResult> => {
    const googleApiKey = options?.googleApiKey ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY;

    try {
      const syncFingerprint = await fetchProfilesMapSyncFingerprint();

      if (!syncFingerprint) {
        throw new Error('Não foi possível verificar atualizações dos perfis.');
      }

      if (!options?.force) {
        const cachedSnapshot = await readProfilesMapSnapshot();
        if (cachedSnapshot?.syncFingerprint === syncFingerprint) {
          const hydrated = hydrateProfilesMapSnapshot(cachedSnapshot);
          const sharedInSnapshot = findCepsSharingCachedCoord(cachedSnapshot.cepToCoord);
          const hasBadCoords = Object.entries(cachedSnapshot.cepToCoord).some(
            ([cepDigits, coord]) => {
              if (isDegenerateMapCoord(coord)) {
                return true;
              }

              const profile = cachedSnapshot.profiles.find(
                (row) => normalizeCepDigits(row.cep) === cepDigits
              );

              return profile ? !isCoordPlausibleForProfile(coord, profile) : false;
            }
          );

          if (hydrated.markers.length > 0 && sharedInSnapshot.size === 0 && !hasBadCoords) {
            return hydrated;
          }
        }
      }

      const snapshot = await fetchAndBuildSnapshot(syncFingerprint, googleApiKey, {
        force: options?.force,
      });
      await writeProfilesMapSnapshot(snapshot);
      return hydrateProfilesMapSnapshot(snapshot);
    } catch (error) {
      const cachedSnapshot = await readProfilesMapSnapshot();
      if (cachedSnapshot) {
        const hydrated = hydrateProfilesMapSnapshot(cachedSnapshot);
        if (hydrated.markers.length > 0) {
          return hydrated;
        }
      }

      throw error;
    }
  };

  const promise = run().finally(() => {
    if (inFlightSync === promise) {
      inFlightSync = null;
    }
  });

  inFlightSync = promise;
  return promise;
};

/** Atualiza o cache em segundo plano (ex.: ao abrir a lista de membros). */
export const prefetchProfilesMapMarkers = () => {
  void syncProfilesMapMarkers().catch((error) => {
    console.warn('Prefetch do mapa de perfis ignorado:', error);
  });
};
