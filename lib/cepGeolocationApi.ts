import {
  isCoordPlausibleForProfile,
  isDegenerateMapCoord,
  LatLng,
  normalizeCepDigits,
  resolveCoordinatesForCep,
  type ProfileGeoInput,
} from '@/lib/geoMapGeocoding';
import { supabase } from '@/lib/supabase';

export type CepGeolocationRow = {
  cep_digits: string;
  cep_formatted: string;
  latitude: number;
  longitude: number;
  logradouro: string | null;
  bairro: string | null;
  localidade: string | null;
  uf: string | null;
  geocode_source: string;
  updated_at: string;
};

const LOW_TRUST_GEOCODE_SOURCES = new Set([
  'tstmax_backfill_approx',
  'approx',
  'app_approx',
]);

export const isLowTrustGeocodeSource = (source: string | null | undefined) => {
  const normalized = (source ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (LOW_TRUST_GEOCODE_SOURCES.has(normalized)) {
    return true;
  }

  return normalized.includes('approx');
};

const rowToCoord = (row: CepGeolocationRow): LatLng | null => {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return { lat, lng };
};

export const fetchCepGeolocationsSyncFingerprint = async (): Promise<string | null> => {
  const { data, error } = await supabase.rpc('fetch_cep_geolocations_sync_fingerprint');

  if (error) {
    const message = (error.message ?? '').toLowerCase();
    if (message.includes('fetch_cep_geolocations_sync_fingerprint')) {
      return null;
    }
    throw error;
  }

  return typeof data === 'string' ? data : null;
};

const mapCepGeolocationRows = (
  rows: Array<Record<string, unknown>> | null | undefined
): Record<string, CepGeolocationRow> => {
  const result: Record<string, CepGeolocationRow> = {};

  for (const row of rows ?? []) {
    const cepDigits = String(row.cep_digits ?? '').trim();
    if (!cepDigits) {
      continue;
    }
    result[cepDigits] = row as CepGeolocationRow;
  }

  return result;
};

export const fetchCepGeolocationRecordsByDigits = async (
  cepDigitsList: string[]
): Promise<Record<string, CepGeolocationRow>> => {
  const uniqueDigits = [...new Set(cepDigitsList.filter(Boolean))];

  if (!uniqueDigits.length) {
    return {};
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'fetch_cep_geolocations_by_digits',
    { p_cep_digits: uniqueDigits }
  );

  if (!rpcError) {
    return mapCepGeolocationRows(rpcData as Array<Record<string, unknown>> | null);
  }

  const rpcMessage = (rpcError.message ?? '').toLowerCase();
  const rpcUnavailable =
    rpcMessage.includes('fetch_cep_geolocations_by_digits')
    && (rpcMessage.includes('could not find') || rpcMessage.includes('does not exist'));

  if (!rpcUnavailable) {
    throw rpcError;
  }

  const { data, error } = await supabase
    .from('cep_geolocations')
    .select(
      'cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source, updated_at'
    )
    .in('cep_digits', uniqueDigits);

  if (error) {
    const message = (error.message ?? '').toLowerCase();
    if (message.includes('cep_geolocations') && message.includes('does not exist')) {
      return {};
    }
    throw error;
  }

  return mapCepGeolocationRows(data as Array<Record<string, unknown>> | null);
};

export const fetchCepGeolocationsByDigits = async (
  cepDigitsList: string[]
): Promise<Record<string, LatLng>> => {
  const records = await fetchCepGeolocationRecordsByDigits(cepDigitsList);
  const result: Record<string, LatLng> = {};

  for (const [cepDigits, row] of Object.entries(records)) {
    const coord = rowToCoord(row);
    if (coord) {
      result[cepDigits] = coord;
    }
  }

  return result;
};

export const upsertCepGeolocation = async ({
  cepDigits,
  coord,
  profile,
  source = 'app_photon',
}: {
  cepDigits: string;
  coord: LatLng;
  profile?: ProfileGeoInput;
  source?: string;
}) => {
  const digits = normalizeCepDigits(cepDigits);
  if (!digits || isDegenerateMapCoord(coord)) {
    return null;
  }

  const { data, error } = await supabase.rpc('upsert_cep_geolocation', {
    p_cep: digits,
    p_latitude: coord.lat,
    p_longitude: coord.lng,
    p_logradouro: profile?.address_street?.trim() || null,
    p_bairro: profile?.address_neighborhood?.trim() || null,
    p_localidade: profile?.address_city?.trim() || null,
    p_uf: profile?.address_state?.trim() || null,
    p_source: source,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();
    if (message.includes('upsert_cep_geolocation')) {
      return null;
    }
    throw error;
  }

  return data;
};

export const resolveAndUpsertCepGeolocation = async ({
  cepDigits,
  profile,
  googleApiKey,
  source = 'app_photon',
}: {
  cepDigits: string;
  profile?: ProfileGeoInput;
  googleApiKey?: string;
  source?: string;
}): Promise<LatLng | null> => {
  const digits = normalizeCepDigits(cepDigits);
  if (!digits) {
    return null;
  }

  const { coord } = await resolveCoordinatesForCep({
    cepDigits: digits,
    profile,
    googleApiKey,
  });

  if (!coord || !isCoordPlausibleForProfile(coord, profile)) {
    return null;
  }

  await upsertCepGeolocation({ cepDigits: digits, coord, profile, source });
  return coord;
};
