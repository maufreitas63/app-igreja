import {
  clearProfileAccessInsightsForSuperAdmin,
  listProfileAccessInsightsForSuperAdmin,
  profileMatchesAccessInsightSearch,
  type ProfileAccessInsightRow,
} from '@/lib/profileAccessInsightsApi';
import { confirmDialog } from '@/lib/confirmDialog';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useMaintenanceProfileAccessInsights(isActive: boolean) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allProfiles, setAllProfiles] = useState<ProfileAccessInsightRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing] = useState(false);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRpcMissing(false);

    try {
      const result = await listProfileAccessInsightsForSuperAdmin();
      setAllProfiles(result.rows.filter((profile) => profile.accessCount > 0));
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

  const clearHistory = useCallback(async () => {
    const confirmed = await confirmDialog(
      'Limpar histórico',
      'Deseja apagar todos os registros de acesso em profile_app_access_events? Esta ação não pode ser desfeita.',
      'Limpar',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return { success: false as const };
    }

    setClearing(true);
    setError(null);

    try {
      const result = await clearProfileAccessInsightsForSuperAdmin();

      if (result.rpcMissing || result.error || !result.success) {
        setRpcMissing(result.rpcMissing);
        setError(result.error);
        return { success: false as const, message: result.error };
      }

      setAllProfiles([]);
      setSearchQuery('');
      return { success: true as const, deletedCount: result.deletedCount };
    } catch (clearError) {
      const message =
        clearError instanceof Error
          ? clearError.message
          : 'Não foi possível limpar o histórico de acessos.';
      setError(message);
      return { success: false as const, message };
    } finally {
      setClearing(false);
    }
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    allProfiles,
    profiles,
    loading,
    clearing,
    error,
    rpcMissing,
    reloadProfiles: loadProfiles,
    clearHistory,
  };
}
