import {
  CHECKIN_STATUS,
  type CheckinStatus,
  TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE,
  type TotemCheckinLookupResult,
} from '@/lib/checkinStatus';
import {
  ensureTotemCheckinFlow,
  formatCheckinRpcError,
  lookupTotemCheckinFallback,
  parseTotemCheckinRpcData,
} from '@/lib/totemCheckinFlow';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { normalizeFamilyId } from '@/lib/totemFamilyId';
import { useCallback, useRef, useState } from 'react';

export type CheckinRow = {
  id: string;
  event_id: string;
  event_registration_id: string;
  family_id: string;
  profile_id: string;
  status: CheckinStatus;
  created_at: string;
  timestamp_confirmacao: string | null;
};

const callLookupRpc = async (eventId: string, familyId: string) => {
  return supabase.rpc('lookup_totem_checkin', {
    p_event_id: eventId,
    p_family_id: normalizeFamilyId(familyId),
  });
};

export const useCheckin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const processingRef = useRef(false);

  const lookupTotemCheckin = useCallback(async (eventId: string, familyId: string) => {
    setLoading(true);
    setError(null);

    try {
      await ensureTotemCheckinFlow();

      let { data, error: rpcError } = await callLookupRpc(eventId, familyId);

      if (rpcError) {
        if (isSupabaseRpcMissingError(rpcError, 'lookup_totem_checkin')) {
          return lookupTotemCheckinFallback(eventId, familyId);
        }

        throw new Error(formatCheckinRpcError(rpcError));
      }

      return parseTotemCheckinRpcData(data);
    } catch (err) {
      const normalized =
        err instanceof Error ? err : new Error(formatCheckinRpcError(err));
      setError(normalized);
      throw normalized;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmTotemCheckin = useCallback(
    async (eventId: string, familyId: string) => {
      if (processingRef.current) {
        return parseTotemCheckinRpcData({
          success: false,
          code: 'PROCESSING',
          message: 'Aguarde o processamento anterior.',
        });
      }

      processingRef.current = true;
      setLoading(true);
      setError(null);

      const normalizedFamilyId = normalizeFamilyId(familyId);

      try {
        await ensureTotemCheckinFlow();

        const { data, error: confirmError } = await supabase.rpc('confirm_totem_checkin', {
          p_event_id: eventId,
          p_family_id: normalizedFamilyId,
        });

        if (!confirmError) {
          return parseTotemCheckinRpcData(data);
        }

        if (!isSupabaseRpcMissingError(confirmError, 'confirm_totem_checkin')) {
          throw new Error(formatCheckinRpcError(confirmError));
        }

        const lookupResult = await lookupTotemCheckinFallback(eventId, familyId);

        if (!lookupResult.success || !lookupResult.can_confirm) {
          return lookupResult;
        }

        throw new Error(
          `Confirmação no totem requer a função confirm_totem_checkin no Supabase.\n\nExecute scripts/checkins-totem-flow.sql.`
        );
      } catch (err) {
        const normalized =
          err instanceof Error ? err : new Error(formatCheckinRpcError(err));
        setError(normalized);
        throw normalized;
      } finally {
        processingRef.current = false;
        setLoading(false);
      }
    },
    []
  );

  const fetchFamilyCheckins = useCallback(async (eventId: string, familyId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('checkins')
        .select(
          'id, event_id, event_registration_id, family_id, profile_id, status, created_at, timestamp_confirmacao'
        )
        .eq('event_id', eventId)
        .eq('family_id', normalizeFamilyId(familyId))
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw new Error(formatCheckinRpcError(fetchError));
      }

      return (data ?? []) as CheckinRow[];
    } catch (err) {
      const normalized =
        err instanceof Error ? err : new Error('Falha ao carregar check-ins da família.');
      setError(normalized);
      throw normalized;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    CHECKIN_STATUS,
    lookupTotemCheckin,
    confirmTotemCheckin,
    fetchFamilyCheckins,
    loading,
    error,
    reset,
  };
};

export { CHECKIN_STATUS, type CheckinStatus, type TotemCheckinLookupResult };
