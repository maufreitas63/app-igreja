import type { FamilyMember } from '@/hooks/useFamilyMembers';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import {
  dedupeFamilyMembers,
  ensureSessionFamilyMemberRecord,
  type SessionProfileAudience,
} from '@/lib/familyAudienceMembers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useFamilyAudienceMembers(
  familyId: string,
  sessionProfile?: SessionProfileAudience | null,
  sessionProfileName?: string | null
) {
  const { members, loading, error, refetch } = useFamilyMembers(familyId);
  const [syncingAudience, setSyncingAudience] = useState(false);
  const sessionProfileId = sessionProfile?.id ?? '';
  const sessionProfilePhone = sessionProfile?.phone ?? null;
  const sessionProfileFullName = sessionProfile?.full_name ?? null;
  const sessionProfileBirthDate = sessionProfile?.birth_date ?? null;
  const audienceSyncKeyRef = useRef('');

  const syncAudience = useCallback(async () => {
    if (!familyId.trim() || !sessionProfileId) {
      return false;
    }

    setSyncingAudience(true);

    try {
      return await ensureSessionFamilyMemberRecord(
        familyId,
        {
          id: sessionProfileId,
          phone: sessionProfilePhone,
          full_name: sessionProfileFullName,
          birth_date: sessionProfileBirthDate,
          family_id: sessionProfile?.family_id ?? null,
        },
        sessionProfileName
      );
    } catch (err) {
      console.error('Erro ao sincronizar audiência familiar:', err);
      return false;
    } finally {
      setSyncingAudience(false);
    }
  }, [
    familyId,
    sessionProfile?.family_id,
    sessionProfileBirthDate,
    sessionProfileFullName,
    sessionProfileId,
    sessionProfilePhone,
    sessionProfileName,
  ]);

  useEffect(() => {
    if (!familyId.trim() || !sessionProfileId) {
      audienceSyncKeyRef.current = '';
      return;
    }

    const syncKey = `${familyId}:${sessionProfileId}`;

    if (audienceSyncKeyRef.current === syncKey) {
      return;
    }

    audienceSyncKeyRef.current = syncKey;

    void (async () => {
      const inserted = await syncAudience();

      if (inserted) {
        await refetch();
      }
    })();
  }, [familyId, refetch, sessionProfileId, syncAudience]);

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
