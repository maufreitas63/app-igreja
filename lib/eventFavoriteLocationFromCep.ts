import { formatCep, lookupViaCep, normalizeCepDigits } from '@/lib/cepUtils';
import {
  fetchCepGeolocationRecordsByDigits,
  resolveAndUpsertCepGeolocation,
} from '@/lib/cepGeolocationApi';

export type EventFavoriteLocationCepResolution = {
  cep: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

const formatAddressFromViaCep = (viaCep: {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}) => {
  const cityState = [viaCep.localidade?.trim(), viaCep.uf?.trim()].filter(Boolean).join('/');
  const line = [viaCep.logradouro?.trim(), viaCep.bairro?.trim(), cityState].filter(Boolean);

  return line.join(' - ');
};

export const resolveEventFavoriteLocationFromCep = async (
  cepInput: string
): Promise<EventFavoriteLocationCepResolution> => {
  const cepDigits = normalizeCepDigits(cepInput);

  if (!cepDigits) {
    throw new Error('Informe o CEP com 8 dígitos (ex.: 11677-042).');
  }

  const viaCep = await lookupViaCep(cepDigits);

  if (!viaCep) {
    throw new Error('CEP não encontrado na consulta ViaCEP.');
  }

  const address = formatAddressFromViaCep(viaCep);
  const profile = {
    cep: formatCep(cepDigits),
    address_street: viaCep.logradouro?.trim() || null,
    address_neighborhood: viaCep.bairro?.trim() || null,
    address_city: viaCep.localidade?.trim() || null,
    address_state: viaCep.uf?.trim() || null,
  };

  const cached = await fetchCepGeolocationRecordsByDigits([cepDigits]);
  const cachedRow = cached[cepDigits];
  let latitude = cachedRow ? Number(cachedRow.latitude) : null;
  let longitude = cachedRow ? Number(cachedRow.longitude) : null;

  if (
    latitude === null
    || longitude === null
    || Number.isNaN(latitude)
    || Number.isNaN(longitude)
  ) {
    const coord = await resolveAndUpsertCepGeolocation({
      cepDigits,
      profile,
    });

    if (coord) {
      latitude = coord.lat;
      longitude = coord.lng;
    }
  }

  return {
    cep: formatCep(cepDigits),
    address,
    latitude,
    longitude,
  };
};
