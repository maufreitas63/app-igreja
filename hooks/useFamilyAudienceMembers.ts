import type { FamilyMember } from '@/hooks/useFamilyMembers';
import {
  dedupeFamilyMembers,
  ensureSessionFamilyMemberRecord,
  fetchFamilyAudienceMembers,
  type SessionProfileAudience,
} from '@/lib/familyAudienceMembers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useFamilyAudienceMembers(
  familyId: string,
  sessionProfile?: SessionProfileAudience | null,
  sessionProfileName?: string | null
) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [syncingAudience, setSyncingAudience] = useState(false);
  const sessionProfileId = sessionProfile?.id ?? '';
  const sessionProfilePhone = sessionProfile?.phone ?? null;
  const sessionProfileFullName = sessionProfile?.full_name ?? null;
  const sessionProfileBirthDate = sessionProfile?.birth_date ?? null;
  const audienceSyncKeyRef = useRef('');

  const refetch = useCallback(async () => {
    if (!familyId.trim()) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextMembers = await fetchFamilyAudienceMembers(familyId);
      setMembers(nextMembers);
    } catch (err) {
      const normalized =
        err instanceof Error ? err : new Error('Não foi possível carregar a audiência familiar.');
      setError(normalized);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

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
    void refetch();
  }, [refetch]);

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
