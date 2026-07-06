import { checkOperatorIsSuperAdmin } from '@/lib/accessControl';
import {
  clearAppActiveStatusCache,
  loadAppActiveStatus,
  type AppActiveStatus,
} from '@/lib/appActiveStatus';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

type UseAppActiveStatusResult = {
  status: AppActiveStatus | null;
  loading: boolean;
  superAdminBypass: boolean;
  refresh: () => Promise<void>;
};

export function useAppActiveStatus(): UseAppActiveStatusResult {
  const [status, setStatus] = useState<AppActiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [superAdminBypass, setSuperAdminBypass] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const nextStatus = await loadAppActiveStatus({ forceRefresh: true });
      setStatus(nextStatus);

      if (nextStatus.active) {
        setSuperAdminBypass(false);
        return;
      }

      const isSuperAdmin = await checkOperatorIsSuperAdmin({ forceRefresh: true });
      setSuperAdminBypass(isSuperAdmin);
    } catch (error) {
      console.error('Erro ao verificar app_ativo:', error);
      setStatus({ active: true, message: '' });
      setSuperAdminBypass(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const nextStatus = await loadAppActiveStatus();
        if (!active) {
          return;
        }

        setStatus(nextStatus);

        if (!nextStatus.active) {
          const isSuperAdmin = await checkOperatorIsSuperAdmin();
          if (active) {
            setSuperAdminBypass(isSuperAdmin);
          }
        } else {
          setSuperAdminBypass(false);
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const nextStatus = await loadAppActiveStatus();
          setStatus(nextStatus);

          if (!nextStatus.active) {
            const isSuperAdmin = await checkOperatorIsSuperAdmin();
            setSuperAdminBypass(isSuperAdmin);
          } else {
            setSuperAdminBypass(false);
          }
        } catch (error) {
          console.error('Erro ao atualizar app_ativo:', error);
        }
      })();

      return undefined;
    }, [])
  );

  return { status, loading, superAdminBypass, refresh };
}

export { clearAppActiveStatusCache };
