import { formatShortName } from '@/lib/formatShortName';
import { formatCep, normalizeCepDigits, type LatLng } from '@/lib/geoMapGeocoding';
import type { MapMarker, ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import { readProfilesMapSnapshot } from '@/lib/profilesMapCache';
import { PROFILE_MAP_ACL_UNAVAILABLE } from '@/lib/profileMapAcl';
import { hydrateProfilesMapSnapshot, syncProfilesMapMarkers } from '@/lib/syncProfilesMapMarkers';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type { MapMarker, ProfileForMap } from '@/lib/profilesMapMarkersTypes';

export type ProfileNotOnMap = ProfileForMap & {
  cepStatus: 'missing' | 'invalid';
  cepDisplay: string;
};

const buildProfilesNotOnMap = (
  profiles: ProfileForMap[],
  cepToCoord: Record<string, LatLng>
): ProfileNotOnMap[] => {
  const result: ProfileNotOnMap[] = [];

  for (const profile of profiles) {
    const cepDigits = normalizeCepDigits(profile.cep);

    if (!cepDigits) {
      result.push({
        ...profile,
        cepStatus: 'missing',
        cepDisplay: profile.cep?.trim() || '—',
      });
      continue;
    }

    if (!cepToCoord[cepDigits]) {
      result.push({
        ...profile,
        cepStatus: 'invalid',
        cepDisplay: profile.cep?.trim() || formatCep(cepDigits),
      });
    }
  }

  return result.sort((left, right) =>
    formatShortName(left.full_name).localeCompare(formatShortName(right.full_name), 'pt-BR')
  );
};

export const useProfilesMapMarkers = () => {
  const googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [profiles, setProfiles] = useState<ProfileForMap[]>([]);
  const [cepToCoord, setCepToCoord] = useState<Record<string, { lat: number; lng: number }>>({});
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [mapCenter, setMapCenter] = useState({ latitude: -23.621, longitude: -45.59 });
  const [invalidCepCount, setInvalidCepCount] = useState(0);
  const [profilesWithoutCepCount, setProfilesWithoutCepCount] = useState(0);

  const applySyncResult = useCallback(
    (result: Awaited<ReturnType<typeof syncProfilesMapMarkers>>) => {
      setProfiles(result.profiles);
      setCepToCoord(result.cepToCoord);
      setMarkers(result.markers);
      setMapCenter(result.mapCenter);
      setInvalidCepCount(result.invalidCepCount);
      setProfilesWithoutCepCount(result.profilesWithoutCepCount);
      setFromCache(result.fromCache);
    },
    []
  );

  const loadData = useCallback(
    async (options?: { force?: boolean }) => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await syncProfilesMapMarkers({
          force: options?.force,
          googleApiKey,
        });
        applySyncResult(result);
      } catch (err) {
        const cachedSnapshot = await readProfilesMapSnapshot();

        if (cachedSnapshot?.profiles?.length) {
          const hydrated = hydrateProfilesMapSnapshot(cachedSnapshot);

          if (hydrated.markers.length) {
            applySyncResult(hydrated);
            setErrorMessage('Sem conexão — exibindo último mapa salvo no dispositivo.');
            return;
          }
        }

        const message =
          err instanceof Error && err.message === PROFILE_MAP_ACL_UNAVAILABLE
            ? 'Não foi possível carregar papéis de acesso do mapa. Tente novamente.'
            : err instanceof Error
              ? err.message
              : 'Erro ao carregar mapa.';
        setErrorMessage(message);
        setProfiles([]);
        setCepToCoord({});
        setMarkers([]);
        setFromCache(false);
      } finally {
        setLoading(false);
      }
    },
    [applySyncResult, googleApiKey]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await loadData();
      } catch {
        if (!active) {
          return;
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadData]);

  const geocoderLabel = googleApiKey?.trim()
    ? 'Google Geocoding + Photon (bairro/rua)'
    : 'ViaCEP + Photon (bairro/rua do CEP)';

  const profilesNotOnMap = useMemo(
    () => buildProfilesNotOnMap(profiles, cepToCoord),
    [profiles, cepToCoord]
  );

  return {
    loading,
    errorMessage,
    markers,
    mapCenter,
    invalidCepCount,
    profilesWithoutCepCount,
    profilesNotOnMap,
    profilesCount: profiles.length,
    geocoderLabel,
    fromCache,
    reload: () => loadData({ force: true }),
  };
};
