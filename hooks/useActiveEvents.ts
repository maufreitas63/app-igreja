import {
  ensureEventsOptionalColumns,
  getActiveEventSelect,
  isMissingEnabledRoomKeysColumnError,
  isMissingGeofenceAtivoColumnError,
  isMissingRequerQuorumColumnError,
  isMissingSomenteMembrosColumnError,
  isMissingTotemColumnError,
  setEnabledRoomKeysColumnAvailable,
  setGeofenceAtivoColumnAvailable,
  setRequerQuorumColumnAvailable,
  setSomenteMembrosColumnAvailable,
  setTotemAtivoColumnAvailable,
  withDefaultEventOptionals,
} from '@/lib/eventsColumnSupport';
import { isEventVisibleInEventPanel } from '@/lib/eventVisibility';
import { lockPastEvents } from '@/lib/lockPastEvents';
import { sessionIsActiveAppMember } from '@/lib/sessionMemberVisibility';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** Intervalo padrão: menos agressivo que 2s (reduz N+1 e re-renders). */
const DEFAULT_EVENT_REFRESH_INTERVAL_MS = 8000;

export type ActiveEventListItem = {
  id: string;
  name: string;
  event_date: string | null;
  event_local: string | null;
  max_capacity: number | null;
  parm_ofertas: boolean | null;
  kids_room: boolean | null;
  teens_room: boolean | null;
  enabled_room_keys?: string[] | null;
  totem_ativo: boolean | null;
  requer_quorum: boolean | null;
  somente_membros: boolean | null;
  geofence_ativo: boolean | null;
  registeredCount: number;
  remainingCapacity: number | null;
  registrationCountError?: boolean;
};

export type UseActiveEventsOptions = {
  /** Quando false, não faz polling (apenas refetch manual). */
  enablePolling?: boolean;
  pollIntervalMs?: number;
  /** Pausa polling com app em segundo plano. */
  pauseWhenBackgrounded?: boolean;
  /**
   * Quando false, não carrega na montagem (útil para modais fechados).
   * Default: true.
   */
  enabled?: boolean;
};

const serializeEvents = (items: ActiveEventListItem[]) =>
  JSON.stringify(
    items.map((event) => ({
      id: event.id,
      name: event.name,
      event_date: event.event_date,
      event_local: event.event_local,
      max_capacity: event.max_capacity,
      parm_ofertas: event.parm_ofertas,
      kids_room: event.kids_room,
      teens_room: event.teens_room,
      enabled_room_keys: event.enabled_room_keys ?? null,
      totem_ativo: event.totem_ativo,
      somente_membros: event.somente_membros,
      geofence_ativo: event.geofence_ativo,
      registeredCount: event.registeredCount,
      remainingCapacity: event.remainingCapacity,
    }))
  );

export const useActiveEvents = (options?: UseActiveEventsOptions) => {
  const enablePolling = options?.enablePolling !== false;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_EVENT_REFRESH_INTERVAL_MS;
  const pauseWhenBackgrounded = options?.pauseWhenBackgrounded !== false;
  const enabled = options?.enabled !== false;

  const [events, setEvents] = useState<ActiveEventListItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const eventsSnapshotRef = useRef('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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

  const commitEvents = useCallback((nextEvents: ActiveEventListItem[]) => {
    const snapshot = serializeEvents(nextEvents);
    if (snapshot === eventsSnapshotRef.current) {
      return;
    }

    eventsSnapshotRef.current = snapshot;
    setEvents(nextEvents);
  }, []);

  const refetch = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);

        // Lock em background — não bloqueia a lista inicial
        void lockPastEvents().catch((lockError) => {
          console.warn('lockPastEvents (background):', lockError);
        });

        const [, isSessionMember] = await Promise.all([
          ensureEventsOptionalColumns(),
          sessionIsActiveAppMember(),
        ]);

        let { data, error: fetchError } = await supabase
          .from('events')
          .select(getActiveEventSelect())
          .or('is_locked.eq.false,is_locked.is.null')
          .order('event_date', { ascending: true });

        if (fetchError && isMissingTotemColumnError(fetchError)) {
          setTotemAtivoColumnAvailable(false);
          const retry = await supabase
            .from('events')
            .select(getActiveEventSelect())
            .or('is_locked.eq.false,is_locked.is.null')
            .order('event_date', { ascending: true });
          data = retry.data;
          fetchError = retry.error;
        } else if (!fetchError) {
          setTotemAtivoColumnAvailable(true);
        }

        if (fetchError && isMissingRequerQuorumColumnError(fetchError)) {
          setRequerQuorumColumnAvailable(false);
          const retry = await supabase
            .from('events')
            .select(getActiveEventSelect())
            .or('is_locked.eq.false,is_locked.is.null')
            .order('event_date', { ascending: true });
          data = retry.data;
          fetchError = retry.error;
        } else if (!fetchError) {
          setRequerQuorumColumnAvailable(true);
        }

        if (fetchError && isMissingSomenteMembrosColumnError(fetchError)) {
          setSomenteMembrosColumnAvailable(false);
          const retry = await supabase
            .from('events')
            .select(getActiveEventSelect())
            .or('is_locked.eq.false,is_locked.is.null')
            .order('event_date', { ascending: true });
          data = retry.data;
          fetchError = retry.error;
        } else if (!fetchError) {
          setSomenteMembrosColumnAvailable(true);
        }

        if (fetchError && isMissingGeofenceAtivoColumnError(fetchError)) {
          setGeofenceAtivoColumnAvailable(false);
          const retry = await supabase
            .from('events')
            .select(getActiveEventSelect())
            .or('is_locked.eq.false,is_locked.is.null')
            .order('event_date', { ascending: true });
          data = retry.data;
          fetchError = retry.error;
        } else if (!fetchError) {
          setGeofenceAtivoColumnAvailable(true);
        }

        if (fetchError && isMissingEnabledRoomKeysColumnError(fetchError)) {
          setEnabledRoomKeysColumnAvailable(false);
          const retry = await supabase
            .from('events')
            .select(getActiveEventSelect())
            .or('is_locked.eq.false,is_locked.is.null')
            .order('event_date', { ascending: true });
          data = retry.data;
          fetchError = retry.error;
        } else if (!fetchError) {
          setEnabledRoomKeysColumnAvailable(true);
        }

        if (fetchError) {
          console.error('Erro na consulta Supabase:', fetchError);
          throw new Error(fetchError.message);
        }

        if (!data?.length) {
          commitEvents([]);
          return;
        }

        const visibleEvents = (data ?? [])
          .map(withDefaultEventOptionals)
          .filter((event) => isEventVisibleInEventPanel(event, isSessionMember));

        if (!visibleEvents.length) {
          commitEvents([]);
          return;
        }

        // Pinta a lista cedo; contagens vêm em seguida (inbox não depende delas)
        const eventsWithoutCounts: ActiveEventListItem[] = visibleEvents.map((event) => ({
          ...event,
          registeredCount: 0,
          remainingCapacity:
            typeof event.max_capacity === 'number' ? event.max_capacity : null,
        }));
        commitEvents(eventsWithoutCounts);
        if (!silent) {
          setLoading(false);
        }

        const eventsWithCounts = await Promise.all(
          visibleEvents.map(async (event) => {
            let registeredCount = 0;
            let registrationCountError = false;

            try {
              registeredCount = await getRegisteredCount(event.id);
            } catch (countError) {
              console.error('Erro ao contar inscrições do evento:', countError);
              registrationCountError = true;
            }
            const maxCapacity =
              typeof event.max_capacity === 'number' ? event.max_capacity : null;

            return {
              ...event,
              registeredCount,
              remainingCapacity:
                maxCapacity === null ? null : Math.max(maxCapacity - registeredCount, 0),
              registrationCountError,
            };
          })
        );

        commitEvents(eventsWithCounts);
      } catch (err: unknown) {
        console.error('Erro no hook useActiveEvents:', err);
        setError(err instanceof Error ? err : new Error('Erro ao carregar eventos.'));
        if (!silent) {
          commitEvents([]);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [commitEvents, getRegisteredCount]
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void refetch();

    if (!enablePolling) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) {
        return;
      }

      intervalId = setInterval(() => {
        if (pauseWhenBackgrounded && appStateRef.current !== 'active') {
          return;
        }

        void refetch(true);
      }, pollIntervalMs);
    };

    const stopPolling = () => {
      if (!intervalId) {
        return;
      }

      clearInterval(intervalId);
      intervalId = null;
    };

    startPolling();

    const appStateSubscription =
      pauseWhenBackgrounded
        ? AppState.addEventListener('change', (nextState) => {
            appStateRef.current = nextState;

            if (nextState === 'active') {
              void refetch(true);
              startPolling();
              return;
            }

            stopPolling();
          })
        : null;

    return () => {
      stopPolling();
      appStateSubscription?.remove();
    };
  }, [enabled, enablePolling, pauseWhenBackgrounded, pollIntervalMs, refetch]);

  return { events, loading, error, refetch };
};
