import {
  listProfilesForPastoralRoleChange,
  PASTORAL_BASIC_ROLE_OPTIONS,
  PASTORAL_ROLE_CHANGE_SQL_HINT,
  profileMatchesPastoralRoleChangeRoleFilter,
  profileMatchesPastoralRoleChangeSearch,
  setPastoralBasicRoleForProfile,
  type PastoralBasicRoleCode,
  type PastoralRoleChangeProfile,
} from '@/lib/pastoralRoleChangeApi';
import { useCallback, useEffect, useMemo, useState } from 'react';

export { PASTORAL_BASIC_ROLE_OPTIONS, PASTORAL_ROLE_CHANGE_SQL_HINT };

export function useMaintenancePastoralRoleChange(isActive: boolean) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<PastoralBasicRoleCode | null>(null);
  const [allProfiles, setAllProfiles] = useState<PastoralRoleChangeProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await listProfilesForPastoralRoleChange();
      setAllProfiles(rows);
    } catch (loadError) {
      console.error('Erro ao carregar perfis para mudança de papel:', loadError);
      setAllProfiles([]);
      setError(
        loadError instanceof Error ? loadError.message : 'Não foi possível carregar a lista de perfis.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void loadProfiles();
  }, [isActive, loadProfiles]);

  const profiles = useMemo(
    () =>
      allProfiles.filter(
        (profile) =>
          profileMatchesPastoralRoleChangeSearch(profile, searchQuery)
          && profileMatchesPastoralRoleChangeRoleFilter(profile, roleFilter)
      ),
    [allProfiles, roleFilter, searchQuery]
  );

  const toggleRoleFilter = useCallback((roleCode: PastoralBasicRoleCode) => {
    setRoleFilter((current) => (current === roleCode ? null : roleCode));
  }, []);

  const updateProfileRole = useCallback(
    async (profileId: string, roleCode: PastoralBasicRoleCode) => {
      setSavingProfileId(profileId);
      setError(null);

      const previousProfiles = allProfiles;

      setAllProfiles((current) =>
        current.map((profile) =>
          profile.id === profileId ? { ...profile, currentRoleCode: roleCode } : profile
        )
      );

      try {
        const result = await setPastoralBasicRoleForProfile(profileId, roleCode);

        if (!result.success) {
          setAllProfiles(previousProfiles);
          setError(result.message);
        }

        return result;
      } catch (saveError) {
        setAllProfiles(previousProfiles);
        const message =
          saveError instanceof Error ? saveError.message : 'Não foi possível alterar o papel.';
        setError(message);
        return { success: false as const, message };
      } finally {
        setSavingProfileId(null);
      }
    },
    [allProfiles]
  );

  return {
    searchQuery,
    setSearchQuery,
    roleFilter,
    toggleRoleFilter,
    allProfiles,
    profiles,
    loading,
    savingProfileId,
    error,
    reloadProfiles: loadProfiles,
    updateProfileRole,
  };
}
