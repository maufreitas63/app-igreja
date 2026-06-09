/**
 * Backfill de cep_geolocations via Photon/ViaCEP (máquina local).
 * Use quando o backfill SQL falhar (extensão http indisponível no Supabase).
 *
 * Política (M3): a fonte primária de coordenadas é o Supabase (`cep_geolocations` /
 * `ensure_cep_geolocation`). Este script é fallback operacional para preencher lacunas.
 *
 * Uso:
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... node scripts/backfill-cep-geolocations.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_SUPABASE_URL = 'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;

const UNRELIABLE_COORDS = [
  { lat: -23.6206, lng: -45.4131 },
  { lat: -23.62028, lng: -45.41306 },
  { lat: -23.6814497, lng: -45.4345116 },
];

const normalizeCepDigits = (cep) => {
  const digits = String(cep ?? '').replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
};

const formatCep = (digits) => `${digits.slice(0, 5)}-${digits.slice(5)}`;

const coordsAreClose = (left, right, epsilon = 0.0002) =>
  Math.abs(left.lat - right.lat) < epsilon && Math.abs(left.lng - right.lng) < epsilon;

const isUnreliableCoord = (coord) =>
  UNRELIABLE_COORDS.some((center) => coordsAreClose(coord, center));

const deriveCityState = (cepDigits, profile, viaCep) => {
  const city = profile?.address_city?.trim() ?? viaCep?.localidade?.trim();
  const state = profile?.address_state?.trim() ?? viaCep?.uf?.trim();

  if (city && state) {
    return { city, state };
  }

  if (cepDigits.startsWith('116')) {
    return { city: city ?? 'Caraguatatuba', state: state ?? 'SP' };
  }

  return { city: city ?? null, state: state ?? null };
};

const supabaseFetch = async (pathname, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(typeof data === 'object' ? JSON.stringify(data) : String(data));
  }

  return data;
};

const lookupViaCep = async (cepDigits) => {
  const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (data.erro) {
    return null;
  }

  return data;
};

const geocodeWithPhoton = async (query) => {
  const params = new URLSearchParams({ q: query, limit: '1' });
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  const coords = json.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) {
    return null;
  }

  const [lng, lat] = coords;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return { lat, lng };
};

const buildGeocodeQueries = (profile, viaCep) => {
  const city = profile?.address_city?.trim() ?? viaCep?.localidade?.trim();
  const state = profile?.address_state?.trim() ?? viaCep?.uf?.trim();
  const neighborhood = profile?.address_neighborhood?.trim() ?? viaCep?.bairro?.trim();
  const street = profile?.address_street?.trim() ?? viaCep?.logradouro?.trim();
  const streetLine = [street, profile?.address_number?.trim()].filter(Boolean).join(', ');

  const queries = [
    [streetLine, neighborhood, city, state].filter(Boolean).join(', '),
    [street, neighborhood, city, state].filter(Boolean).join(', '),
    [viaCep?.logradouro, viaCep?.bairro, viaCep?.localidade, viaCep?.uf].filter(Boolean).join(', '),
    [neighborhood, city, state].filter(Boolean).join(', '),
    [street, city, state].filter(Boolean).join(', '),
  ];

  return [...new Set(queries.filter(Boolean))];
};

const resolveCoordinatesForCep = async (cepDigits, profile) => {
  const viaCep = (await lookupViaCep(cepDigits)) ?? null;
  const { city, state } = deriveCityState(cepDigits, profile, viaCep);

  if (!city || !state) {
    return { coord: null, viaCep, error: 'Cidade/UF não encontradas' };
  }

  const isAcceptable = (coord) => !isUnreliableCoord(coord);

  const queries = viaCep ? buildGeocodeQueries(profile, viaCep) : [];
  queries.push(`${formatCep(cepDigits)}, ${city} - ${state}, Brasil`);

  for (const query of queries) {
    const coord = await geocodeWithPhoton(query);
    if (coord && isAcceptable(coord)) {
      return { coord, viaCep, query };
    }
  }

  return { coord: null, viaCep, error: 'Photon não retornou coordenadas' };
};

const upsertCepGeolocation = async ({ cepDigits, coord, profile, viaCep, source }) =>
  supabaseFetch('/rest/v1/rpc/upsert_cep_geolocation', {
    method: 'POST',
    body: JSON.stringify({
      p_cep: cepDigits,
      p_latitude: coord.lat,
      p_longitude: coord.lng,
      p_logradouro: profile?.address_street?.trim() || viaCep?.logradouro || null,
      p_bairro: profile?.address_neighborhood?.trim() || viaCep?.bairro || null,
      p_localidade: profile?.address_city?.trim() || viaCep?.localidade || null,
      p_uf: profile?.address_state?.trim() || viaCep?.uf || null,
      p_source: source,
    }),
  });

const fetchProfilesWithCep = async () =>
  supabaseFetch(
    '/rest/v1/profiles?select=cep,address_street,address_number,address_neighborhood,address_city,address_state&cep=not.is.null'
  );

const main = async () => {
  const profiles = await fetchProfilesWithCep();
  const byCep = new Map();

  for (const profile of profiles) {
    const cepDigits = normalizeCepDigits(profile.cep);
    if (!cepDigits || byCep.has(cepDigits)) {
      continue;
    }
    byCep.set(cepDigits, profile);
  }

  const results = {
    total_ceps: byCep.size,
    geocoded: 0,
    failed: 0,
    items: [],
  };

  const sqlLines = [
    '-- Gerado por scripts/backfill-cep-geolocations.mjs',
    '-- Execute no SQL Editor se a RPC falhar.',
    '',
  ];

  for (const [cepDigits, profile] of [...byCep.entries()].sort()) {
    const { coord, viaCep, query, error } = await resolveCoordinatesForCep(cepDigits, profile);

    if (!coord) {
      results.failed += 1;
      results.items.push({ cep: formatCep(cepDigits), status: 'failed', error, query: query ?? null });
      console.error(`Falhou ${formatCep(cepDigits)}: ${error ?? 'sem coordenadas'}`);
      continue;
    }

    try {
      await upsertCepGeolocation({
        cepDigits,
        coord,
        profile,
        viaCep,
        source: 'backfill_script',
      });

      results.geocoded += 1;
      results.items.push({
        cep: formatCep(cepDigits),
        status: 'ok',
        lat: coord.lat,
        lng: coord.lng,
        query: query ?? null,
      });

      sqlLines.push(
        `insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)`,
        `values (`,
        `  '${cepDigits}',`,
        `  '${formatCep(cepDigits)}',`,
        `  ${coord.lat},`,
        `  ${coord.lng},`,
        `  ${profile.address_street || viaCep?.logradouro ? `'${String(profile.address_street || viaCep?.logradouro).replace(/'/g, "''")}'` : 'null'},`,
        `  ${profile.address_neighborhood || viaCep?.bairro ? `'${String(profile.address_neighborhood || viaCep?.bairro).replace(/'/g, "''")}'` : 'null'},`,
        `  ${profile.address_city || viaCep?.localidade ? `'${String(profile.address_city || viaCep?.localidade).replace(/'/g, "''")}'` : 'null'},`,
        `  ${profile.address_state || viaCep?.uf ? `'${String(profile.address_state || viaCep?.uf).replace(/'/g, "''")}'` : 'null'},`,
        `  'backfill_script'`,
        `)`,
        `on conflict (cep_digits) do update set`,
        `  latitude = excluded.latitude,`,
        `  longitude = excluded.longitude,`,
        `  geocode_source = excluded.geocode_source,`,
        `  updated_at = now();`,
        ''
      );

      console.log(`OK ${formatCep(cepDigits)} → ${coord.lat}, ${coord.lng}`);
    } catch (upsertError) {
      results.failed += 1;
      results.items.push({
        cep: formatCep(cepDigits),
        status: 'upsert_failed',
        error: String(upsertError),
        lat: coord.lat,
        lng: coord.lng,
      });
      console.error(`RPC falhou ${formatCep(cepDigits)}:`, upsertError);
    }
  }

  const seedPath = path.join(__dirname, 'cep-geolocation-seed.sql');
  writeFileSync(seedPath, `${sqlLines.join('\n')}\n`, 'utf8');

  console.log('\nResumo:', JSON.stringify(results, null, 2));
  console.log(`\nSQL de fallback salvo em: ${seedPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
