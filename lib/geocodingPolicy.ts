/**
 * M3: política de geocodificação — servidor (`cep_geolocations` / `ensure_cep_geolocation`) é a fonte primária.
 * O cliente só geocodifica em fallback (mapa sync com CEP ausente no Supabase).
 */
export const GEOCODING_PRIMARY_SOURCE = 'supabase_cep_geolocations' as const;

export const shouldClientGeocodeCep = (hasServerCoord: boolean, forceRefresh: boolean) =>
  !hasServerCoord || forceRefresh;
