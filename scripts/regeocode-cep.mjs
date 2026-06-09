/**
 * Regrava coordenadas de um CEP em cep_geolocations (ViaCEP + Photon com validação).
 * Uso: node scripts/regeocode-cep.mjs 11660-400
 */

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

const cepArg = (process.argv[2] ?? '').replace(/\D/g, '');
if (cepArg.length !== 8) {
  console.error('Informe um CEP com 8 dígitos. Ex.: node scripts/regeocode-cep.mjs 11660-400');
  process.exit(1);
}

const formatCep = (digits) => `${digits.slice(0, 5)}-${digits.slice(5)}`;

const normalizePhotonCepDigits = (value) => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
};

const isPhotonPostcodeMismatch = (feature, targetCepDigits) => {
  const props = feature.properties;
  if (!props || props.osm_value !== 'postcode') {
    return false;
  }

  const candidate =
    normalizePhotonCepDigits(props.postcode) ?? normalizePhotonCepDigits(props.name);

  return candidate !== null && candidate !== targetCepDigits;
};

async function lookupViaCep(cepDigits) {
  const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.erro) return null;
  return data;
}

async function geocodeWithPhoton(query, context) {
  const params = new URLSearchParams({ q: query, limit: '5' });
  const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
  if (!res.ok) return null;

  const json = await res.json();
  for (const feature of json.features ?? []) {
    if (isPhotonPostcodeMismatch(feature, context.targetCepDigits)) {
      continue;
    }

    const city = (feature.properties?.city ?? '').trim().toLowerCase();
    const expectedCity = (context.city ?? '').trim().toLowerCase();
    if (expectedCity && city && city !== expectedCity) {
      continue;
    }

    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    const [lng, lat] = coords;
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    return { lat, lng, name: feature.properties?.name ?? null };
  }

  return null;
}

function buildQueries(cepDigits, viaCep) {
  const city = viaCep.localidade?.trim();
  const state = viaCep.uf?.trim();
  const street = viaCep.logradouro?.trim();
  const neighborhood = viaCep.bairro?.trim();
  const formatted = formatCep(cepDigits);
  const streetQueries = [];
  const cepQueries = [];

  if (street && city && state) {
    streetQueries.push([street, neighborhood, city, state].filter(Boolean).join(', '));
    streetQueries.push([street, city, state].filter(Boolean).join(', '));
  }

  if (neighborhood && city && state) {
    streetQueries.push([neighborhood, city, state].filter(Boolean).join(', '));
  }

  if (city && state) {
    cepQueries.push(`${formatted}, ${city}, ${state}`);
  }

  return [...new Set([...streetQueries, ...cepQueries])];
}

async function api(path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function main() {
  const viaCep = await lookupViaCep(cepArg);
  if (!viaCep) {
    throw new Error(`ViaCEP não encontrou ${formatCep(cepArg)}`);
  }

  console.log('ViaCEP:', {
    cep: formatCep(cepArg),
    logradouro: viaCep.logradouro,
    bairro: viaCep.bairro,
    cidade: viaCep.localidade,
    uf: viaCep.uf,
  });

  const queries = buildQueries(cepArg, viaCep);
  let coord = null;
  let matchedQuery = null;
  let matchedName = null;

  for (const query of queries) {
    const result = await geocodeWithPhoton(query, {
      targetCepDigits: cepArg,
      city: viaCep.localidade,
      state: viaCep.uf,
    });

    if (result) {
      coord = { lat: result.lat, lng: result.lng };
      matchedQuery = query;
      matchedName = result.name;
      break;
    }
  }

  if (!coord) {
    throw new Error('Photon não retornou coordenadas válidas para este CEP.');
  }

  console.log('Photon:', { query: matchedQuery, name: matchedName, ...coord });

  await api('/rest/v1/rpc/upsert_cep_geolocation', {
    p_cep: cepArg,
    p_latitude: coord.lat,
    p_longitude: coord.lng,
    p_logradouro: viaCep.logradouro?.trim() || null,
    p_bairro: viaCep.bairro?.trim() || null,
    p_localidade: viaCep.localidade?.trim() || null,
    p_uf: viaCep.uf?.trim() || null,
    p_source: 'regeocode_viacep_street',
  });

  const rows = await api('/rest/v1/rpc/fetch_cep_geolocations_by_digits', {
    p_cep_digits: [cepArg],
  });

  console.log('Gravado em cep_geolocations:', rows);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
