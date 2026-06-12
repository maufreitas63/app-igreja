import { isEventVisibleForCheckIn } from '@/lib/eventVisibility';
import { lockPastEvents } from '@/lib/lockPastEvents';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

const EVENT_REFRESH_INTERVAL_MS = 8000;

export type ActiveEvent = {
  id: string;
  name: string;
  max_capacity: number | null;
  registeredCount: number;
  remainingCapacity: number | null;
  registrationCountError?: boolean;
};

export const useActiveEvent = () => {
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getRegisteredCount = useCallback(async (eventId: string) => {
    const { data: rpcCount, error: rpcError } = await supabase.rpc(
      'get_event_registration_count',
      { p_event_id: eventId }
    );

    if (!rpcError) {
      return typeof rpcCount === 'number'
        ? rpcCount
        : Number.parseInt(String(rpcCount ?? 0), 10) || 0;
    }

    console.error('Erro ao buscar total de inscritos via RPC:', rpcError);

    const { count, error: countError } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (countError) {
      console.error('Erro ao buscar total de inscritos diretamente:', countError);
      throw new Error(countError.message || 'Não foi possível contar inscrições do evento.');
    }

    return count ?? 0;
  }, []);

  const refetch = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      await lockPastEvents();

      const { data: rows, error: fetchError } = await supabase
        .from('events')
        .select('id, name, max_capacity, event_date, is_locked')
        .or('is_locked.eq.false,is_locked.is.null')
        .order('event_date', { ascending: true });

      if (fetchError) {
        console.error("Erro na consulta Supabase:", fetchError);
        throw new Error(fetchError.message);
      }

      const data = (rows ?? []).find((row) => isEventVisibleForCheckIn(row)) ?? null;

      if (!data) {
        setEvent(null);
        return;
      }

      let registeredCount = 0;
      let registrationCountError = false;

      try {
        registeredCount = await getRegisteredCount(data.id);
      } catch (countError) {
        console.error('Erro ao contar inscrições do evento:', countError);
        registrationCountError = true;
      }

      const maxCapacity =
        typeof data.max_capacity === 'number' ? data.max_capacity : null;

      setEvent({
        ...data,
        registeredCount,
        remainingCapacity:
          maxCapacity === null ? null : Math.max(maxCapacity - registeredCount, 0),
        registrationCountError,
      });
    } catch (err: unknown) {
      console.error('Erro no hook useActiveEvent:', err);
      setError(err instanceof Error ? err : new Error('Erro ao carregar evento.'));
      if (!silent) {
        setEvent(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [getRegisteredCount]);

  useEffect(() => {
    void refetch();

    const intervalId = setInterval(() => {
      void refetch(true);
    }, EVENT_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [refetch]);

  return { event, loading, error, refetch };
};