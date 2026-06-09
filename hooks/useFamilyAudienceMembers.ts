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
      return;
    }

    setSyncingAudience(true);

    try {
      const inserted = await ensureSessionFamilyMemberRecord(
        familyId,
        sessionProfile,
        sessionProfileName
      );

      if (inserted) {
        await refetch();
      }
    } catch (err) {
      console.error('Erro ao sincronizar audiência familiar:', err);
    } finally {
      setSyncingAudience(false);
    }
  }, [familyId, refetch, sessionProfile, sessionProfileName]);

  useEffect(() => {
    void syncAudience();
  }, [syncAudience]);

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
