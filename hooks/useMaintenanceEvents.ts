import {
  ensureEventsOptionalColumns,
  getMaintenanceEventSelect,
  isMissingRequerQuorumColumnError,
  isMissingTotemColumnError,
  setRequerQuorumColumnAvailable,
  setTotemAtivoColumnAvailable,
  withDefaultEventOptionals,
} from '@/lib/eventsColumnSupport';
import { lockPastEvents } from '@/lib/lockPastEvents';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export type MaintenanceEvent = {
  id: string;
  name: string;
  event_date: string | null;
  event_local: string | null;
  max_capacity: number | null;
  parm_ofertas: boolean | null;
  kids_room: boolean | null;
  teens_room: boolean | null;
  totem_ativo: boolean | null;
  requer_quorum: boolean | null;
  is_locked: boolean | null;
};

export const useMaintenanceEvents = () => {
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await ensureEventsOptionalColumns();
      await lockPastEvents();

      let { data, error: fetchError } = await supabase
        .from('events')
        .select(getMaintenanceEventSelect())
        .order('event_date', { ascending: true, nullsFirst: false });

      if (fetchError && isMissingTotemColumnError(fetchError)) {
        setTotemAtivoColumnAvailable(false);
        const retry = await supabase
          .from('events')
          .select(getMaintenanceEventSelect())
          .order('event_date', { ascending: true, nullsFirst: false });
        data = retry.data;
        fetchError = retry.error;
      } else if (!fetchError) {
        setTotemAtivoColumnAvailable(true);
      }

      if (fetchError && isMissingRequerQuorumColumnError(fetchError)) {
        setRequerQuorumColumnAvailable(false);
        const retry = await supabase
          .from('events')
          .select(getMaintenanceEventSelect())
          .order('event_date', { ascending: true, nullsFirst: false });
        data = retry.data;
        fetchError = retry.error;
      } else if (!fetchError) {
        setRequerQuorumColumnAvailable(true);
      }

      if (fetchError) {
        throw fetchError;
      }

      const rows = ((data as MaintenanceEvent[]) ?? []).map(withDefaultEventOptionals);
      setEvents(rows);
    } catch (err) {
      console.error('Erro ao carregar eventos (manutenção):', err);
      setError(err instanceof Error ? err : new Error('Não foi possível carregar os eventos.'));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { events, loading, error, refetch };
};
