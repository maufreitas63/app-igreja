import { supabase } from '@/lib/supabase';

export type EventFavoriteLocation = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  sort_order: number;
  is_active: boolean;
};

export const EVENT_FAVORITE_LOCATIONS_SQL_HINT =
  'Execute scripts/event-favorite-locations.sql no Supabase para habilitar locais favoritos de eventos.';

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

export const fetchEventFavoriteLocations = async (): Promise<{
  rows: EventFavoriteLocation[];
  schemaMissing: boolean;
}> => {
  const { data, error } = await supabase
    .from('event_favorite_locations')
    .select('id, name, address, latitude, longitude, capacity, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (isMissingFavoriteLocationsTableError(error)) {
      return { rows: [], schemaMissing: true };
    }

    throw error;
  }

  return {
    rows: (data as EventFavoriteLocation[]) ?? [],
    schemaMissing: false,
  };
};
