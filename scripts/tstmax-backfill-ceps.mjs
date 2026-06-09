/**
 * Backfill rápido dos CEPs TstMax em cep_geolocations (coordenadas aproximadas por cidade).
 * Uso: node scripts/tstmax-backfill-ceps.mjs
 */

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

const CITY_CENTERS = {
  'caraguatatuba|sp': { lat: -23.6206, lng: -45.4131 },
  'ubatuba|sp': { lat: -23.433889, lng: -45.071944 },
  'sao sebastiao|sp': { lat: -23.76, lng: -45.41 },
};

function cityCenterKey(city, state) {
  const normalizedCity = (city || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return `${normalizedCity}|${(state || 'sp').trim().toLowerCase()}`;
}

function approximateCoordForCep(cepDigits, city, state) {
  const center = CITY_CENTERS[cityCenterKey(city, state)];
  if (!center) return null;

  const suffix = Number.parseInt(cepDigits.slice(-5), 10) || 0;
  const prefix = Number.parseInt(cepDigits.slice(0, 3), 10) || 0;
  const angle = ((suffix * 137 + prefix * 17) % 360) * (Math.PI / 180);
  const distanceKm = 0.35 + (suffix % 11) * 0.18;
  const kmPerDegLat = 111.32;
  const latRadians = (center.lat * Math.PI) / 180;
  const kmPerDegLng = Math.max(kmPerDegLat * Math.cos(latRadians), 0.01);

  return {
    lat: center.lat + (distanceKm / kmPerDegLat) * Math.cos(angle),
    lng: center.lng + (distanceKm / kmPerDegLng) * Math.sin(angle),
  };
}

async function api(path, body) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

const SAMPLE_CEPS = ['11660029', '11660020', '11680036', '11600037'];

async function main() {
  const profiles = await api(
    '/rest/v1/profiles?family_id=like.TstMax*&select=cep,address_city,address_state,address_neighborhood&cep=not.is.null'
  );

  const byCep = new Map();
  for (const profile of profiles || []) {
    const digits = (profile.cep || '').replace(/\D/g, '');
    if (digits.length !== 8 || byCep.has(digits)) continue;
    byCep.set(digits, profile);
  }

  let upserted = 0;
  for (const [cepDigits, profile] of byCep.entries()) {
    const coord = approximateCoordForCep(
      cepDigits,
      profile.address_city,
      profile.address_state
    );
    if (!coord) continue;

    await api('/rest/v1/rpc/upsert_cep_geolocation', {
      p_cep: cepDigits,
      p_latitude: coord.lat,
      p_longitude: coord.lng,
      p_logradouro: null,
      p_bairro: profile.address_neighborhood?.trim() || null,
      p_localidade: profile.address_city?.trim() || null,
      p_uf: profile.address_state?.trim() || 'SP',
      p_source: 'tstmax_backfill_approx',
    });
    upserted += 1;
  }

  console.log(`CEPs gravados: ${upserted}/${byCep.size}`);

  try {
    const rows = await api('/rest/v1/rpc/fetch_cep_geolocations_by_digits', {
      p_cep_digits: SAMPLE_CEPS,
    });
    console.log('Amostra RPC:', rows);
  } catch (err) {
    console.warn('RPC fetch_cep_geolocations_by_digits indisponível:', err.message);
    console.warn('Execute scripts/cep-geolocation-map-read-rpc.sql no Supabase.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
