import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

/** Acesso à rota `/igrejas` — apenas super_admin. */
export function useIgrejasAdminAccess(redirectPath: string = '/(tabs)'): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        setStatus('checking');
        try {
          const isSuper = await checkSessionIsSuperAdmin();
          if (!active) return;
          if (!isSuper) {
            setStatus('denied');
            denyScreenAccessAndRedirect(
              router,
              redirectPath,
              'Acesso negado',
              'Apenas super administradores gerenciam instâncias.'
            );
            return;
          }
          setStatus('allowed');
        } catch {
          if (!active) return;
          setStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            redirectPath,
            'Acesso negado',
            'Não foi possível validar o acesso.'
          );
        }
      })();

      return () => {
        active = false;
      };
    }, [redirectPath, router])
  );

  return status;
}
