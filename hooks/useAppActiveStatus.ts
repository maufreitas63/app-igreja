import { checkOperatorIsSuperAdmin, invalidateOperatorSuperAdminCache } from '@/lib/accessControl';
import {
  clearAppActiveStatusCache,
  loadAppActiveStatus,
  registerAppActiveSessionListener,
  type AppActiveStatus,
} from '@/lib/appActiveStatus';
import { useCallback, useEffect, useState } from 'react';

type UseAppActiveStatusResult = {
  status: AppActiveStatus | null;
  loading: boolean;
  superAdminBypass: boolean;
};

async function resolveSuperAdminBypass(status: AppActiveStatus, forceRefresh: boolean) {
  if (status.active) {
    return false;
  }

  return checkOperatorIsSuperAdmin({ forceRefresh });
}

async function fetchAppActiveGateState(forceRefresh: boolean): Promise<{
  status: AppActiveStatus;
  superAdminBypass: boolean;
}> {
  if (forceRefresh) {
    invalidateOperatorSuperAdminCache();
    clearAppActiveStatusCache();
  }

  const nextStatus = await loadAppActiveStatus({ forceRefresh });
  const bypass = await resolveSuperAdminBypass(nextStatus, forceRefresh);

  return { status: nextStatus, superAdminBypass: bypass };
}

export function useAppActiveStatus(): UseAppActiveStatusResult {
  const [status, setStatus] = useState<AppActiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [superAdminBypass, setSuperAdminBypass] = useState(false);

  const applyGateState = useCallback(
    (next: { status: AppActiveStatus; superAdminBypass: boolean }) => {
      setStatus(next.status);
      setSuperAdminBypass(next.superAdminBypass);
    },
    []
  );

  const refreshAfterSessionEstablished = useCallback(async () => {
    try {
      const next = await fetchAppActiveGateState(true);
      applyGateState(next);
    } catch (error) {
      console.error('Erro ao revalidar app_ativo após login:', error);
    } finally {
      setLoading(false);
    }
  }, [applyGateState]);

  useEffect(() => {
    registerAppActiveSessionListener(refreshAfterSessionEstablished);

    return () => {
      registerAppActiveSessionListener(null);
    };
  }, [refreshAfterSessionEstablished]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const next = await fetchAppActiveGateState(false);
        if (active) {
          applyGateState(next);
        }
      } catch (error) {
        console.error('Erro ao carregar app_ativo:', error);
        if (active) {
          setStatus({ active: true, message: '' });
          setSuperAdminBypass(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [applyGateState]);

  return { status, loading, superAdminBypass };
}

export { clearAppActiveStatusCache } from '@/lib/appActiveStatus';
