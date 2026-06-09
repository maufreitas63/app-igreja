import { supabase } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export type QuorumRegistryRow = {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string | null;
  event_local: string | null;
  max_capacity: number | null;
  participant_name: string | null;
  participant_phone: string | null;
  participant_email: string | null;
  participant_cpf: string | null;
  checkin_status: string;
  registered_at: string;
  confirmed_at: string | null;
};

export const QUORUM_REGISTRY_SQL_HINT =
  'Execute no Supabase o script scripts/events-quorum-registry.sql (tabela event_quorum_registry e sincronização).';

export class QuorumRegistryUnavailableError extends Error {
  constructor(message = QUORUM_REGISTRY_SQL_HINT) {
    super(message);
    this.name = 'QuorumRegistryUnavailableError';
  }
}

let quorumRegistryTableAvailable: boolean | null = null;

const isMissingTableError = (error: Pick<PostgrestError, 'code' | 'message'> | null) => {
  if (!error) {
    return false;
  }

  if (error.code === '42P01' || error.code === 'PGRST205') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return message.includes('event_quorum_registry') && message.includes('does not exist');
};

export function isQuorumRegistryTableAvailable() {
  return quorumRegistryTableAvailable === true;
}

export function setQuorumRegistryTableAvailable(value: boolean) {
  quorumRegistryTableAvailable = value;
}

export async function probeQuorumRegistryTable(): Promise<boolean> {
  const { error } = await supabase.from('event_quorum_registry').select('id').limit(1);

  if (error) {
    if (isMissingTableError(error)) {
      setQuorumRegistryTableAvailable(false);
      return false;
    }

    throw error;
  }

  setQuorumRegistryTableAvailable(true);
  return true;
}

export async function ensureEventQuorumRegistry(): Promise<boolean> {
  if (await probeQuorumRegistryTable().catch(() => false)) {
    return true;
  }

  const { error } = await supabase.rpc('ensure_event_quorum_registry');

  if (error) {
    const message = (error.message ?? '').toLowerCase();
    if (
      message.includes('ensure_event_quorum_registry') &&
      (message.includes('does not exist') || message.includes('could not find'))
    ) {
      setQuorumRegistryTableAvailable(false);
      return false;
    }

    console.warn('ensure_event_quorum_registry:', error.message);
    setQuorumRegistryTableAvailable(false);
    return false;
  }

  quorumRegistryTableAvailable = null;
  return probeQuorumRegistryTable().catch(() => false);
}

export async function fetchEventQuorumRegistry(eventId: string): Promise<QuorumRegistryRow[]> {
  if (quorumRegistryTableAvailable !== true) {
    const ready = await ensureEventQuorumRegistry();
    if (!ready) {
      throw new QuorumRegistryUnavailableError();
    }
  }

  const { data, error } = await supabase
    .from('event_quorum_registry')
    .select(
      'id, event_id, event_name, event_date, event_local, max_capacity, participant_name, participant_phone, participant_email, participant_cpf, checkin_status, registered_at, confirmed_at'
    )
    .eq('event_id', eventId)
    .order('registered_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      setQuorumRegistryTableAvailable(false);
      throw new QuorumRegistryUnavailableError();
    }

    throw error;
  }

  return (data ?? []) as QuorumRegistryRow[];
}
