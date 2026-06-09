import { supabase } from '@/lib/supabase';
import { useCallback, useState } from 'react';

export type UnregisterMemberInput = {
  eventId: string;
  memberId: string;
  familyId: string;
};

export type UnregisterMemberResult = {
  success: boolean;
  message?: string;
};

export const useUnregisterMember = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unregisterMember = useCallback(async (vars: UnregisterMemberInput) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('unregister_member_atomic', {
        p_event_id: vars.eventId,
        p_member_id: vars.memberId,
        p_family_group_id: vars.familyId,
      });

      if (rpcError) throw rpcError;

      const result = data as UnregisterMemberResult | null;
      if (!result?.success) {
        throw new Error(result?.message ?? 'Falha ao remover membro do evento.');
      }

      return result;
    } catch (err) {
      const normalized =
        err instanceof Error ? err : new Error('Falha ao remover membro do evento.');
      setError(normalized);
      throw normalized;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { unregisterMember, loading, error, reset };
};
