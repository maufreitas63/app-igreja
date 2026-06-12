import type { FamilyMember } from '@/hooks/useFamilyMembers';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import {
  dedupeFamilyMembers,
  ensureSessionFamilyMemberRecord,
  type SessionProfileAudience,
} from '@/lib/familyAudienceMembers';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useFamilyAudienceMembers(
  familyId: string,
  sessionProfile?: SessionProfileAudience | null,
  sessionProfileName?: string | null
) {
  const { members, loading, error, refetch } = useFamilyMembers(familyId);
  const [syncingAudience, setSyncingAudience] = useState(false);

  const syncAudience = useCallback(async () => {
    if (!familyId.trim() || !sessionProfile?.id) {
      return false;
    }

    setSyncingAudience(true);

    try {
      return await ensureSessionFamilyMemberRecord(
        familyId,
        sessionProfile,
        sessionProfileName
      );
    } catch (err) {
      console.error('Erro ao sincronizar audiência familiar:', err);
      return false;
    } finally {
      setSyncingAudience(false);
    }
  }, [familyId, sessionProfile, sessionProfileName]);

  useEffect(() => {
    void (async () => {
      const inserted = await syncAudience();
      if (inserted) {
        await refetch();
      }
    })();
  }, [refetch, syncAudience]);

  const audienceMembers = useMemo(() => dedupeFamilyMembers(members), [members]);

  const refetchAudience = useCallback(async () => {
    await syncAudience();
    await refetch();
  }, [refetch, syncAudience]);

  return {
    members: audienceMembers,
    loading: loading || syncingAudience,
    error,
    refetch: refetchAudience,
  } satisfies {
    members: FamilyMember[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
  };
}
