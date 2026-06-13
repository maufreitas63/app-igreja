import {
  listProfileAccessInsightsForSuperAdmin,
  profileMatchesAccessInsightSearch,
  type ProfileAccessInsightRow,
} from '@/lib/profileAccessInsightsApi';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useMaintenanceProfileAccessInsights(isActive: boolean) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allProfiles, setAllProfiles] = useState<ProfileAccessInsightRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing] = useState(false);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRpcMissing(false);

    try {
      const result = await listProfileAccessInsightsForSuperAdmin();
      setAllProfiles(result.rows);
      setRpcMissing(result.rpcMissing);
      setError(result.error);
    } catch (loadError) {
      console.error('Erro ao carregar histórico de acessos:', loadError);
      setAllProfiles([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o histórico de acessos.'
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
    () => allProfiles.filter((profile) => profileMatchesAccessInsightSearch(profile, searchQuery)),
    [allProfiles, searchQuery]
  );

  const profilesWithAccess = useMemo(
    () => allProfiles.filter((profile) => profile.accessCount > 0).length,
    [allProfiles]
  );

  return {
    searchQuery,
    setSearchQuery,
    allProfiles,
    profiles,
    profilesWithAccess,
    loading,
    error,
    rpcMissing,
    reloadProfiles: loadProfiles,
  };
}
