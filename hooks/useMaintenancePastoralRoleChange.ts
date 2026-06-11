import {
  PASTORAL_BASIC_ROLE_OPTIONS,
  PASTORAL_ROLE_CHANGE_SQL_HINT,
  searchProfilesForPastoralRoleChange,
  setPastoralBasicRoleForProfile,
  type PastoralBasicRoleCode,
  type PastoralRoleChangeProfile,
} from '@/lib/pastoralRoleChangeApi';
import { useCallback, useEffect, useState } from 'react';

export { PASTORAL_BASIC_ROLE_OPTIONS, PASTORAL_ROLE_CHANGE_SQL_HINT };

export function useMaintenancePastoralRoleChange(isActive: boolean) {
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<PastoralRoleChangeProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const query = searchQuery.trim();

    if (query.length < 2) {
      setProfiles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchProfilesForPastoralRoleChange(query);

          if (active) {
            setProfiles(rows);
          }
        } catch (searchError) {
          console.error('Erro ao buscar perfis para mudança de papel:', searchError);

          if (active) {
            setProfiles([]);
            setError(
              searchError instanceof Error
                ? searchError.message
                : 'Não foi possível buscar perfis.'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isActive, searchQuery]);

  const updateProfileRole = useCallback(
    async (profileId: string, roleCode: PastoralBasicRoleCode) => {
      setSavingProfileId(profileId);
      setError(null);

      const previousProfiles = profiles;

      setProfiles((current) =>
        current.map((profile) =>
          profile.id === profileId ? { ...profile, currentRoleCode: roleCode } : profile
        )
      );

      try {
        const result = await setPastoralBasicRoleForProfile(profileId, roleCode);

        if (!result.success) {
          setProfiles(previousProfiles);
          setError(result.message);
        }

        return result;
      } catch (saveError) {
        setProfiles(previousProfiles);
        const message =
          saveError instanceof Error ? saveError.message : 'Não foi possível alterar o papel.';
        setError(message);
        return { success: false as const, message };
      } finally {
        setSavingProfileId(null);
      }
    },
    [profiles]
  );

  return {
    searchQuery,
    setSearchQuery,
    profiles,
    loading,
    savingProfileId,
    error,
    updateProfileRole,
  };
}
