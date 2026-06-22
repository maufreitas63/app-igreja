import { supabase } from '@/lib/supabase';

export type EventFavoriteLocation = {
  id: string;
  name: string;
  cep: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  sort_order: number;
  is_active: boolean;
};

export type EventFavoriteLocationInput = {
  name: string;
  cep: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  sort_order: number;
  is_active: boolean;
};

export const EVENT_FAVORITE_LOCATIONS_SQL_HINT =
  'Execute scripts/event-favorite-locations.sql no Supabase para habilitar locais favoritos de eventos.';

export const EVENT_FAVORITE_LOCATIONS_CEP_SQL_HINT =
  'Execute scripts/event-favorite-locations-cep.sql no Supabase para habilitar o campo CEP nos locais favoritos.';

const FAVORITE_LOCATION_COLUMNS =
  'id, name, cep, address, latitude, longitude, capacity, sort_order, is_active';

const isMissingFavoriteLocationsTableError = (error: { code?: string; message?: string } | null) => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();

  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || (message.includes('event_favorite_locations') && message.includes('does not exist'))
    || (message.includes('event_favorite_locations') && message.includes('não existe'))
  );
};

export const isMissingFavoriteLocationsCepColumnError = (
  error: { code?: string; message?: string } | null
) => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();

  return (
    error.code === 'PGRST204'
    || (message.includes('cep') && message.includes('event_favorite_locations'))
    || (message.includes('column') && message.includes('cep') && message.includes('does not exist'))
  );
};

const normalizePayload = (input: EventFavoriteLocationInput) => ({
  name: input.name.trim(),
  cep: input.cep?.trim() || null,
  address: input.address.trim(),
  latitude: input.latitude,
  longitude: input.longitude,
  capacity: input.capacity,
  sort_order: input.sort_order,
  is_active: input.is_active,
});

export const fetchEventFavoriteLocations = async (): Promise<{
  rows: EventFavoriteLocation[];
  schemaMissing: boolean;
  cepColumnMissing: boolean;
}> => {
  const { data, error } = await supabase
    .from('event_favorite_locations')
    .select(FAVORITE_LOCATION_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (isMissingFavoriteLocationsTableError(error)) {
      return { rows: [], schemaMissing: true, cepColumnMissing: false };
    }

    if (isMissingFavoriteLocationsCepColumnError(error)) {
      const fallback = await supabase
        .from('event_favorite_locations')
        .select('id, name, address, latitude, longitude, capacity, sort_order, is_active')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (fallback.error) {
        throw fallback.error;
      }

      const rows = ((fallback.data as Omit<EventFavoriteLocation, 'cep'>[]) ?? []).map((row) => ({
        ...row,
        cep: null,
      }));

      return {
        rows,
        schemaMissing: false,
        cepColumnMissing: true,
      };
    }

    throw error;
  }

  return {
    rows: (data as EventFavoriteLocation[]) ?? [],
    schemaMissing: false,
    cepColumnMissing: false,
  };
};

export const createEventFavoriteLocation = async (input: EventFavoriteLocationInput) => {
  const { data, error } = await supabase
    .from('event_favorite_locations')
    .insert(normalizePayload(input))
    .select(FAVORITE_LOCATION_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as EventFavoriteLocation;
};

export const updateEventFavoriteLocation = async (
  id: string,
  input: EventFavoriteLocationInput
) => {
  const { data, error } = await supabase
    .from('event_favorite_locations')
    .update(normalizePayload(input))
    .eq('id', id)
    .select(FAVORITE_LOCATION_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as EventFavoriteLocation;
};

export const deleteEventFavoriteLocation = async (id: string) => {
  const { data, error } = await supabase
    .from('event_favorite_locations')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    throw error;
  }

  if (!data?.length) {
    throw new Error('Nenhum local favorito foi apagado.');
  }
};
