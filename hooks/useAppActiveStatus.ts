import { checkOperatorIsSuperAdmin, invalidateOperatorSuperAdminCache } from '@/lib/accessControl';
import {
  clearAppActiveStatusCache,
  loadAppActiveStatus,
  registerAppActiveSessionListener,
  type AppActiveStatus,
} from '@/lib/appActiveStatus';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

type UseAppActiveStatusResult = {
  status: AppActiveStatus | null;
  loading: boolean;
  rechecking: boolean;
  superAdminBypass: boolean;
  refresh: (options?: { silent?: boolean; forceRefresh?: boolean }) => Promise<void>;
};

async function resolveSuperAdminBypass(status: AppActiveStatus, forceRefresh: boolean) {
  if (status.active) {
    return false;
  }

  return checkOperatorIsSuperAdmin({ forceRefresh });
}

export function useAppActiveStatus(): UseAppActiveStatusResult {
  const [status, setStatus] = useState<AppActiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [superAdminBypass, setSuperAdminBypass] = useState(false);

  const refresh = useCallback(async (options?: { silent?: boolean; forceRefresh?: boolean }) => {
    const silent = options?.silent === true;
    const forceRefresh = options?.forceRefresh === true;

    if (!silent) {
      setLoading(true);
    } else {
      setRechecking(true);
    }

    try {
      if (forceRefresh) {
        invalidateOperatorSuperAdminCache();
        clearAppActiveStatusCache();
      }

      const nextStatus = await loadAppActiveStatus({ forceRefresh });
      setStatus(nextStatus);
      setSuperAdminBypass(await resolveSuperAdminBypass(nextStatus, forceRefresh || !silent));
    } catch (error) {
      console.error('Erro ao verificar app_ativo:', error);
      setStatus({ active: true, message: '' });
      setSuperAdminBypass(false);
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setRechecking(false);
    }
  }, []);

  const refreshAfterSessionEstablished = useCallback(async () => {
    invalidateOperatorSuperAdminCache();
    clearAppActiveStatusCache();

    const nextStatus = await loadAppActiveStatus({ forceRefresh: true });
    setStatus(nextStatus);
    setSuperAdminBypass(await resolveSuperAdminBypass(nextStatus, true));
    setLoading(false);
    setRechecking(false);
  }, []);

  useEffect(() => {
    registerAppActiveSessionListener(refreshAfterSessionEstablished);

    return () => {
      registerAppActiveSessionListener(null);
    };
  }, [refreshAfterSessionEstablished]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh({ silent: true, forceRefresh: true });
      return undefined;
    }, [refresh])
  );

  return { status, loading, rechecking, superAdminBypass, refresh };
}

export { clearAppActiveStatusCache } from '@/lib/appActiveStatus';
