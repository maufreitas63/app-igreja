import { supabase } from '@/lib/supabase';
import { useCallback, useState } from 'react';

export type RegisterMemberInput = {
  eventId: string;
  memberId: string;
  familyId: string;
};

export type RegisterMemberResult = {
  success: boolean;
  message?: string;
};

export const useRegisterMember = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registerMember = useCallback(async (vars: RegisterMemberInput) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('register_member_atomic', {
        p_event_id: vars.eventId,
        p_member_id: vars.memberId,
        p_family_group_id: vars.familyId,
      });

      if (rpcError) throw rpcError;

      const result = data as RegisterMemberResult | null;
      if (!result?.success) {
        throw new Error(result?.message ?? 'Falha ao registrar membro no evento.');
      }

      return result;
    } catch (err) {
      const normalized =
        err instanceof Error ? err : new Error('Falha ao registrar membro no evento.');
      setError(normalized);
      throw normalized;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { registerMember, loading, error, reset };
};
