import type { CepGeolocationRow } from '@/lib/cepGeolocationApi';
import { formatCep } from '@/lib/geoMapGeocoding';
import type { ProfileForMap } from '@/lib/profilesMapMarkersTypes';

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

export const profileHasMapAddress = (profile: ProfileForMap) =>
  hasText(profile.address_street)
  || hasText(profile.address_neighborhood)
  || hasText(profile.address_city)
  || hasText(profile.address_state);

export const enrichProfileMapAddress = (
  profile: ProfileForMap,
  cepRecordsByDigits: Record<string, Pick<CepGeolocationRow, 'logradouro' | 'bairro' | 'localidade' | 'uf'>>
): ProfileForMap => {
  const cepDigits = (profile.cep ?? '').replace(/\D/g, '');
  const cepRecord = cepDigits.length === 8 ? cepRecordsByDigits[cepDigits] : undefined;

  if (!cepRecord) {
    return profile;
  }

  return {
    ...profile,
    address_street: hasText(profile.address_street) ? profile.address_street : cepRecord.logradouro,
    address_neighborhood: hasText(profile.address_neighborhood)
      ? profile.address_neighborhood
      : cepRecord.bairro,
    address_city: hasText(profile.address_city) ? profile.address_city : cepRecord.localidade,
    address_state: hasText(profile.address_state) ? profile.address_state : cepRecord.uf,
  };
};

export const enrichProfilesMapAddresses = (
  profiles: ProfileForMap[],
  cepRecordsByDigits: Record<string, Pick<CepGeolocationRow, 'logradouro' | 'bairro' | 'localidade' | 'uf'>>
) => profiles.map((profile) => enrichProfileMapAddress(profile, cepRecordsByDigits));

export type ProfileMapAddressDisplay = {
  cepLine: string;
  streetLine: string | null;
  locationLine: string | null;
  hasAddress: boolean;
};

export const buildProfileMapAddressDisplay = (profile: ProfileForMap): ProfileMapAddressDisplay => {
  const street = profile.address_street?.trim();
  const number = profile.address_number?.trim();
  const neighborhood = profile.address_neighborhood?.trim();
  const city = profile.address_city?.trim();
  const state = profile.address_state?.trim();

  const streetLine = street
    ? `${street}${number ? `, ${number}` : ''}`
    : number
      ? `Nº ${number}`
      : null;

  const cityState = city && state ? `${city}/${state}` : city || state || null;
  const locationLine = [neighborhood, cityState].filter(Boolean).join(' · ') || null;

  return {
    cepLine: profile.cep?.trim() || '—',
    streetLine,
    locationLine,
    hasAddress: Boolean(streetLine || locationLine),
  };
};

export type ProfileNavigationAddressInput = Pick<
  ProfileForMap,
  | 'cep'
  | 'address_street'
  | 'address_number'
  | 'address_neighborhood'
  | 'address_city'
  | 'address_state'
>;

/** Endereço completo em uma linha para colar em Waze, Google Maps, etc. */
export const buildProfileMapNavigationAddressLine = (
  profile: ProfileNavigationAddressInput
): string | null => {
  const cepDigits = (profile.cep ?? '').replace(/\D/g, '');
  const formattedCep =
    cepDigits.length === 8 ? formatCep(cepDigits) : profile.cep?.trim() || null;

  const street = profile.address_street?.trim();
  const number = profile.address_number?.trim();
  const neighborhood = profile.address_neighborhood?.trim();
  const city = profile.address_city?.trim();
  const state = profile.address_state?.trim();

  const streetPart = street
    ? `${street}${number ? `, ${number}` : ''}`
    : number
      ? `Nº ${number}`
      : null;

  const parts = [streetPart, neighborhood, city, state, formattedCep].filter(
    (part): part is string => Boolean(part?.trim())
  );

  if (!parts.length) {
    return null;
  }

  return parts.join(', ');
};
