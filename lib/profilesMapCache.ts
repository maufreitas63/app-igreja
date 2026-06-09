import type { LatLng } from '@/lib/geoMapGeocoding';
import type { ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const CEP_COORD_CACHE_KEY = 'geoCepCache.v11';
export const PROFILES_MAP_SNAPSHOT_KEY = 'profilesMapSnapshot.v10';

const LEGACY_CEP_COORD_CACHE_KEYS = [
  'geoCepCache.v2',
  'geoCepCache.v3',
  'geoCepCache.v4',
  'geoCepCache.v5',
  'geoCepCache.v6',
  'geoCepCache.v7',
  'geoCepCache.v8',
  'geoCepCache.v9',
  'geoCepCache.v10',
] as const;

const LEGACY_PROFILES_MAP_SNAPSHOT_KEYS = [
  'profilesMapSnapshot.v1',
  'profilesMapSnapshot.v2',
  'profilesMapSnapshot.v3',
  'profilesMapSnapshot.v4',
  'profilesMapSnapshot.v5',
  'profilesMapSnapshot.v6',
  'profilesMapSnapshot.v7',
  'profilesMapSnapshot.v8',
  'profilesMapSnapshot.v9',
] as const;

export type ProfilesMapSnapshot = {
  version: 1;
  syncFingerprint: string;
  cachedAt: string;
  profiles: ProfileForMap[];
  cepToCoord: Record<string, LatLng>;
  invalidCepCount: number;
  profilesWithoutCepCount: number;
};

const normalizeSnapshotProfile = (profile: ProfileForMap): ProfileForMap => ({
  ...profile,
  phone: profile.phone ?? null,
  isVisitantesOnly: profile.isVisitantesOnly ?? true,
  roleLabel: profile.roleLabel?.trim() || (profile.isVisitantesOnly ? 'Visitante' : 'Membro'),
});

export const PROFILE_GEO_FIELDS = new Set([
  'cep',
  'address_street',
  'address_number',
  'address_neighborhood',
  'address_city',
  'address_state',
  'address_complement',
]);

const readStorageItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
};

const writeStorageItem = async (key: string, value: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
};

const removeStorageItem = async (key: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.removeItem(key);
    return;
  }

  await AsyncStorage.removeItem(key);
};

const parseCoordCache = (raw: string | null): Record<string, LatLng> => {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, LatLng>;
  } catch {
    return {};
  }
};

export const readCepCoordCache = async (): Promise<Record<string, LatLng>> => {
  try {
    await purgeLegacyMapCacheKeys();
    const current = parseCoordCache(await readStorageItem(CEP_COORD_CACHE_KEY));
    if (Object.keys(current).length > 0) {
      return current;
    }

    return {};
  } catch {
    return {};
  }
};

export const writeCepCoordCache = async (cache: Record<string, LatLng>) => {
  await writeStorageItem(CEP_COORD_CACHE_KEY, JSON.stringify(cache));
};

export const readProfilesMapSnapshot = async (): Promise<ProfilesMapSnapshot | null> => {
  try {
    const raw = await readStorageItem(PROFILES_MAP_SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ProfilesMapSnapshot;
    if (parsed?.version !== 1 || !Array.isArray(parsed.profiles) || !parsed.syncFingerprint) {
      return null;
    }

    return {
      ...parsed,
      profiles: parsed.profiles.map((profile) => normalizeSnapshotProfile(profile)),
    };
  } catch {
    return null;
  }
};

export const writeProfilesMapSnapshot = async (snapshot: ProfilesMapSnapshot) => {
  await writeStorageItem(PROFILES_MAP_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

export const invalidateProfilesMapSnapshot = async () => {
  await removeStorageItem(PROFILES_MAP_SNAPSHOT_KEY);
};

/** Remove chaves órfãs de versões antigas do mapa no dispositivo (M4). */
export const purgeLegacyMapCacheKeys = async () => {
  await Promise.all([
    ...LEGACY_CEP_COORD_CACHE_KEYS.map((key) => removeStorageItem(key)),
    ...LEGACY_PROFILES_MAP_SNAPSHOT_KEYS.map((key) => removeStorageItem(key)),
  ]);
};
