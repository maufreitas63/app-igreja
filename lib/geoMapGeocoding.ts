import { formatCep, normalizeCepDigits } from '@/lib/cepUtils';
import { Platform } from 'react-native';

export { formatCep, normalizeCepDigits };

export type LatLng = { lat: number; lng: number };

export type ProfileGeoInput = {
  cep?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  complemento?: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    countrycode?: string;
    osm_value?: string;
    postcode?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

export type PhotonGeocodeContext = {
  targetCepDigits?: string;
  city?: string | null;
  state?: string | null;
};

const NOMINATIM_DELAY_MS = 1100;
let lastNominatimRequestAt = 0;
const ENABLE_NOMINATIM = Platform.OS !== 'web';

/** Coordenadas genéricas que APIs repetem para consultas amplas. */
const UNRELIABLE_MAP_COORDS: LatLng[] = [
  { lat: -23.6206, lng: -45.4131 },
  { lat: -23.62028, lng: -45.41306 },
  { lat: -23.6814497, lng: -45.4345116 },
];

const CITY_CENTERS: Record<string, LatLng> = {
  'caraguatatuba|sp': { lat: -23.6206, lng: -45.4131 },
  'ubatuba|sp': { lat: -23.433889, lng: -45.071944 },
  'sao sebastiao|sp': { lat: -23.76, lng: -45.41 },
  'são sebastião|sp': { lat: -23.76, lng: -45.41 },
};

const CEP_PREFIX_CITY_DEFAULTS: Record<string, { city: string; state: string }> = {
  '11660': { city: 'Caraguatatuba', state: 'SP' },
  '11680': { city: 'Ubatuba', state: 'SP' },
  '11600': { city: 'São Sebastião', state: 'SP' },
};

const SYNTHETIC_STREET_PATTERN = /^tstmax\b/i;
const MAX_CITY_DISTANCE_KM = 45;

const normalizeCityStateKey = (city: string, state: string) => {
  const normalizedCity = city
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const normalizedState = state.trim().toLowerCase();
  return `${normalizedCity}|${normalizedState}`;
};

const haversineKm = (left: LatLng, right: LatLng) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(right.lat - left.lat);
  const dLng = toRadians(right.lng - left.lng);
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const isSyntheticSeedStreet = (street: string | null | undefined) => {
  const value = street?.trim();
  if (!value) {
    return false;
  }

  return SYNTHETIC_STREET_PATTERN.test(value);
};

export const isCoordPlausibleForCity = (
  coord: LatLng,
  city?: string | null,
  state?: string | null,
  maxKm = MAX_CITY_DISTANCE_KM
) => {
  if (!city?.trim() || !state?.trim()) {
    return true;
  }

  const key = normalizeCityStateKey(city, state);
  const center = CITY_CENTERS[key];
  if (!center) {
    return true;
  }

  return haversineKm(coord, center) <= maxKm;
};

const STATE_BOUNDS: Record<string, { lat: [number, number]; lng: [number, number] }> = {
  SP: { lat: [-25.4, -19.8], lng: [-53.2, -44.0] },
  RJ: { lat: [-23.4, -20.7], lng: [-44.9, -40.9] },
  MG: { lat: [-22.9, -14.2], lng: [-51.1, -39.8] },
  PR: { lat: [-26.7, -22.5], lng: [-54.6, -48.0] },
  SC: { lat: [-29.4, -25.9], lng: [-53.8, -48.3] },
  RS: { lat: [-33.8, -27.0], lng: [-57.8, -49.8] },
};

const coordsAreClose = (left: LatLng, right: LatLng, epsilon = 0.0002) =>
  Math.abs(left.lat - right.lat) < epsilon && Math.abs(left.lng - right.lng) < epsilon;

export const isDegenerateMapCoord = (coord: LatLng) =>
  UNRELIABLE_MAP_COORDS.some((center) => coordsAreClose(coord, center));

export const isUnreliableMapCoord = isDegenerateMapCoord;

const isWithinBounds = (coord: LatLng, bounds: { lat: [number, number]; lng: [number, number] }) =>
  coord.lat >= bounds.lat[0]
  && coord.lat <= bounds.lat[1]
  && coord.lng >= bounds.lng[0]
  && coord.lng <= bounds.lng[1];

export const isCoordPlausibleForState = (coord: LatLng, state: string | null | undefined) => {
  const uf = state?.trim().toUpperCase();
  if (!uf) {
    return true;
  }

  const bounds = STATE_BOUNDS[uf];
  if (!bounds) {
    return true;
  }

  return isWithinBounds(coord, bounds);
};

export const isCoordPlausibleForProfile = (
  coord: LatLng,
  profile?: ProfileGeoInput,
  viaUf?: string | null
) => {
  const state = profile?.address_state?.trim() ?? viaUf?.trim();
  const city = profile?.address_city?.trim();

  return (
    isCoordPlausibleForState(coord, state)
    && !isDegenerateMapCoord(coord)
    && isCoordPlausibleForCity(coord, city, state)
  );
};

/** Último recurso offline — não representa o endereço real. */
export const approximateCoordForCep = (
  cepDigits: string,
  city?: string | null,
  state?: string | null
): LatLng | null => {
  const key =
    city?.trim() && state?.trim()
      ? normalizeCityStateKey(city, state)
      : null;
  const center = key ? CITY_CENTERS[key] : null;

  if (!center) {
    return null;
  }

  const suffix = Number.parseInt(cepDigits.slice(-5), 10) || 0;
  const prefix = Number.parseInt(cepDigits.slice(0, 3), 10) || 0;
  const angle = ((suffix * 137 + prefix * 17) % 360) * (Math.PI / 180);
  const distanceKm = 0.35 + ((suffix % 11) * 0.18);
  const latRadians = (center.lat * Math.PI) / 180;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = Math.max(kmPerDegLat * Math.cos(latRadians), 0.01);

  return {
    lat: center.lat + (distanceKm / kmPerDegLat) * Math.cos(angle),
    lng: center.lng + (distanceKm / kmPerDegLng) * Math.sin(angle),
  };
};

const deriveCityState = (
  cepDigits: string,
  profile?: ProfileGeoInput,
  viaCep?: ViaCepResponse | null
) => {
  const city = profile?.address_city?.trim() ?? viaCep?.localidade?.trim();
  const state = profile?.address_state?.trim() ?? viaCep?.uf?.trim();

  if (city && state) {
    return { city, state };
  }

  const prefixDefaults = CEP_PREFIX_CITY_DEFAULTS[cepDigits.slice(0, 5)];
  if (prefixDefaults) {
    return {
      city: city ?? prefixDefaults.city,
      state: state ?? prefixDefaults.state,
    };
  }

  if (cepDigits.startsWith('116')) {
    return { city: city ?? 'Caraguatatuba', state: state ?? 'SP' };
  }

  return { city: city ?? null, state: state ?? null };
};

const buildViaCepFromProfile = (
  cepDigits: string,
  profile?: ProfileGeoInput
): ViaCepResponse | null => {
  const { city, state } = deriveCityState(cepDigits, profile, null);

  if (!city || !state) {
    return null;
  }

  const profileStreet = profile?.address_street?.trim();

  return {
    logradouro:
      profileStreet && !isSyntheticSeedStreet(profileStreet) ? profileStreet : undefined,
    bairro: profile?.address_neighborhood?.trim() || undefined,
    localidade: city,
    uf: state,
  };
};

const waitForNominatimSlot = async () => {
  const now = Date.now();
  const waitMs = Math.max(0, lastNominatimRequestAt + NOMINATIM_DELAY_MS - now);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastNominatimRequestAt = Date.now();
};

export const lookupViaCep = async (cepDigits: string): Promise<ViaCepResponse | null> => {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
};

const normalizePhotonCepDigits = (value: string | null | undefined) => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
};

const normalizePhotonCity = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

/** Photon costuma devolver outro CEP (ex.: 11660-280) ao buscar 11660-400. */
export const isPhotonPostcodeMismatch = (
  feature: PhotonFeature,
  targetCepDigits: string | null | undefined
) => {
  if (!targetCepDigits) {
    return false;
  }

  const props = feature.properties;
  if (!props || props.osm_value !== 'postcode') {
    return false;
  }

  const candidateDigits =
    normalizePhotonCepDigits(props.postcode)
    ?? normalizePhotonCepDigits(props.name);

  return candidateDigits !== null && candidateDigits !== targetCepDigits;
};

const photonFeatureMatchesContext = (
  feature: PhotonFeature,
  context?: PhotonGeocodeContext
) => {
  if (!context?.targetCepDigits && !context?.city) {
    return true;
  }

  if (isPhotonPostcodeMismatch(feature, context.targetCepDigits)) {
    return false;
  }

  const featureCity = normalizePhotonCity(feature.properties?.city);
  const expectedCity = normalizePhotonCity(context.city);

  if (expectedCity && featureCity && featureCity !== expectedCity) {
    return false;
  }

  const countryCode = feature.properties?.countrycode?.trim().toUpperCase();
  if (countryCode && countryCode !== 'BR') {
    return false;
  }

  return true;
};

const buildGeocodeQueries = (
  cepDigits: string,
  profile: ProfileGeoInput | undefined,
  viaCep: ViaCepResponse
) => {
  const city = profile?.address_city?.trim() ?? viaCep.localidade?.trim();
  const state = profile?.address_state?.trim() ?? viaCep.uf?.trim();
  const neighborhood = profile?.address_neighborhood?.trim() ?? viaCep.bairro?.trim();
  const profileStreet = profile?.address_street?.trim();
  const viaStreet = viaCep.logradouro?.trim();
  const street =
    profileStreet && !isSyntheticSeedStreet(profileStreet)
      ? profileStreet
      : viaStreet;
  const number = profile?.address_number?.trim();
  const formattedCep = formatCep(cepDigits);
  const streetQueries: string[] = [];
  const cepQueries: string[] = [];

  if (viaStreet && city && state) {
    streetQueries.push(
      [viaStreet, viaCep.bairro, viaCep.localidade, viaCep.uf].filter(Boolean).join(', ')
    );
  }

  if (neighborhood && city && state) {
    streetQueries.push([neighborhood, city, state].filter(Boolean).join(', '));
  }

  if (street && city && state) {
    const streetLine = [street, number].filter(Boolean).join(', ');
    streetQueries.push([streetLine, neighborhood, city, state].filter(Boolean).join(', '));
    streetQueries.push([street, neighborhood, city, state].filter(Boolean).join(', '));
    streetQueries.push([street, city, state].filter(Boolean).join(', '));
  }

  if (city && state) {
    cepQueries.push(`${formattedCep}, ${city}, ${state}`);
    cepQueries.push(`${formattedCep}, ${city} - ${state}, Brasil`);
  }

  return [...new Set([...streetQueries, ...cepQueries].filter((query): query is string => Boolean(query?.trim())))];
};

export const geocodeWithPhoton = async (
  query: string,
  context?: PhotonGeocodeContext
): Promise<LatLng | null> => {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: '5',
    });

    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as PhotonResponse;

    for (const feature of json.features ?? []) {
      if (!photonFeatureMatchesContext(feature, context)) {
        continue;
      }

      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) {
        continue;
      }

      const [lng, lat] = coords;
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        continue;
      }

      return { lat, lng };
    }

    return null;
  } catch {
    return null;
  }
};

export const geocodeWithNominatim = async (query: string): Promise<LatLng | null> => {
  if (!ENABLE_NOMINATIM) {
    return null;
  }

  try {
    await waitForNominatimSlot();

    const params = new URLSearchParams({
      format: 'json',
      q: query,
      limit: '1',
      countrycodes: 'br',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'app-igreja/1.0 (geolocation map)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { lat?: string; lon?: string }[];
    const first = data[0];
    if (!first?.lat || !first?.lon) {
      return null;
    }

    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return null;
    }

    return { lat, lng };
  } catch {
    return null;
  }
};

export const geocodeWithGoogle = async (
  address: string,
  apiKey: string
): Promise<LatLng | null> => {
  try {
    const params = new URLSearchParams({
      address,
      key: apiKey,
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
    const json = (await response.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };

    if (json.status !== 'OK') {
      return null;
    }

    const lat = json.results?.[0]?.geometry?.location?.lat;
    const lng = json.results?.[0]?.geometry?.location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return null;
    }

    return { lat, lng };
  } catch {
    return null;
  }
};

const geocodeWithProviders = async (
  queries: string[],
  isAcceptable: (coord: LatLng) => boolean,
  photonContext?: PhotonGeocodeContext
): Promise<LatLng | null> => {
  for (const query of queries) {
    const photonCoord = await geocodeWithPhoton(query, photonContext);
    if (photonCoord && isAcceptable(photonCoord)) {
      return photonCoord;
    }
  }

  if (ENABLE_NOMINATIM) {
    for (const query of queries) {
      const nominatimCoord = await geocodeWithNominatim(`${query}, Brasil`);
      if (nominatimCoord && isAcceptable(nominatimCoord)) {
        return nominatimCoord;
      }
    }
  }

  return null;
};

export const resolveCoordinatesForCep = async ({
  cepDigits,
  profile,
  googleApiKey,
}: {
  cepDigits: string;
  profile?: ProfileGeoInput;
  googleApiKey?: string;
}): Promise<{ coord: LatLng | null; error?: string }> => {
  try {
    const viaCep = (await lookupViaCep(cepDigits)) ?? buildViaCepFromProfile(cepDigits, profile);
    const { city, state } = deriveCityState(cepDigits, profile, viaCep);

    if (!city || !state) {
      return { coord: null, error: 'Cidade/UF não encontradas para o CEP' };
    }

    const isAcceptable = (coord: LatLng) =>
      isCoordPlausibleForState(coord, state)
      && !isUnreliableMapCoord(coord)
      && isCoordPlausibleForCity(coord, city, state);

    const queries = viaCep ? buildGeocodeQueries(cepDigits, profile, viaCep) : [];
    const trimmedGoogleKey = googleApiKey?.trim();

    if (trimmedGoogleKey) {
      for (const query of queries) {
        const googleCoord = await geocodeWithGoogle(`${query}, Brasil`, trimmedGoogleKey);
        if (googleCoord && isAcceptable(googleCoord)) {
          return { coord: googleCoord };
        }
      }

      const googleCepCoord = await geocodeWithGoogle(
        `${formatCep(cepDigits)}, ${city} - ${state}, Brasil`,
        trimmedGoogleKey
      );
      if (googleCepCoord && isAcceptable(googleCepCoord)) {
        return { coord: googleCepCoord };
      }
    }

    const providerCoord = await geocodeWithProviders(queries, isAcceptable, {
      targetCepDigits: cepDigits,
      city,
      state,
    });
    if (providerCoord) {
      return { coord: providerCoord };
    }

    const approximateCoord = approximateCoordForCep(cepDigits, city, state);
    if (approximateCoord) {
      return { coord: approximateCoord, error: 'Posição aproximada (sem geocodificação exata)' };
    }

    return { coord: null, error: 'Não foi possível converter o endereço em coordenadas' };
  } catch {
    const { city, state } = deriveCityState(cepDigits, profile, null);
    const approximateCoord = approximateCoordForCep(cepDigits, city, state);

    if (approximateCoord) {
      return { coord: approximateCoord, error: 'Posição aproximada (falha de rede)' };
    }

    return { coord: null, error: 'Falha de rede ao geocodificar' };
  }
};
