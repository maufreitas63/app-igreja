import { getEventCalendarDate, getTodayCalendarDateInAppTimezone } from '@/lib/eventDate';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export class LockPastEventsUnavailableError extends Error {
  constructor(message = 'Não foi possível bloquear eventos passados no Supabase.') {
    super(message);
    this.name = 'LockPastEventsUnavailableError';
  }
}

/** Fallback: atualiza is_locked no cliente quando a RPC ainda não existe no projeto. */
const lockPastEventsViaClientUpdate = async (): Promise<number> => {
  const today = getTodayCalendarDateInAppTimezone();

  const { data, error } = await supabase
    .from('events')
    .select('id, event_date, is_locked');

  if (error) {
    console.warn('lockPastEvents fallback select:', error.message);
    throw new LockPastEventsUnavailableError(error.message);
  }

  const idsToLock = (data ?? [])
    .filter((row) => {
      if (row.is_locked === true) {
        return false;
      }

      const eventDay = getEventCalendarDate(row.event_date);
      return Boolean(eventDay && eventDay < today);
    })
    .map((row) => row.id);

  if (!idsToLock.length) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from('events')
    .update({ is_locked: true })
    .in('id', idsToLock);

  if (updateError) {
    console.warn('lockPastEvents fallback update:', updateError.message);
    return 0;
  }

  return idsToLock.length;
};

/**
 * Sincroniza is_locked=true para eventos com data no passado.
 * Usa RPC `lock_past_events` no Supabase; se ausente, faz update direto (RLS).
 */
export async function lockPastEvents(): Promise<number> {
  const { data, error } = await supabase.rpc('lock_past_events');

  if (!error) {
    return typeof data === 'number' ? data : Number.parseInt(String(data ?? 0), 10) || 0;
  }

  if (isSupabaseRpcMissingError(error, 'lock_past_events')) {
    return lockPastEventsViaClientUpdate();
  }

  console.warn('lock_past_events:', error.message);
  return lockPastEventsViaClientUpdate().catch(() => 0);
}
