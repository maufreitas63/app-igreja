import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { FAIL_CLOSED_REDIRECT_PATH } from '@/lib/failClosedNavigation';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { loadMaintenanceDashboardAccess } from '@/lib/maintenanceDashboardAccess';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { isTotemDeviceSession } from '@/lib/totemDevice';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

type LeadershipRouteGuardOptions = {
  deniedMessage: string;
  redirectPath?: string;
  /** Super admin ou grant da tela de manutenção. */
  requireMaintenance?: boolean;
  /** Super admin, manutenção ou configuração de salas. */
  allowRoomManagers?: boolean;
  /** Dispositivo totem autenticado (kiosk). */
  allowTotemDevice?: boolean;
};

/**
 * Fail-closed para rotas de gestão: só liderança validada na sessão/tenant.
 */
export function useLeadershipRouteGuard({
  deniedMessage,
  redirectPath = FAIL_CLOSED_REDIRECT_PATH,
  requireMaintenance = false,
  allowRoomManagers = false,
  allowTotemDevice = false,
}: LeadershipRouteGuardOptions): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        setStatus('checking');

        try {
          if (allowTotemDevice && (await isTotemDeviceSession())) {
            if (!active) return;
            setStatus('allowed');
            return;
          }

          const [isSuperAdmin, maintenance, roomAccess] = await Promise.all([
            checkSessionIsSuperAdmin().catch(() => false),
            loadMaintenanceDashboardAccess(),
            allowRoomManagers
              ? sessionHasAccess('screen', ACCESS_SCREEN.configuracaoSalas, 'view')
              : Promise.resolve(false),
          ]);

          if (!active) return;

          const hasLeadership =
            isSuperAdmin === true
            || maintenance.allowed === true
            || (allowRoomManagers && roomAccess === true);

          const allowed = requireMaintenance
            ? isSuperAdmin === true || maintenance.allowed === true
            : hasLeadership;

          if (!allowed) {
            setStatus('denied');
            denyScreenAccessAndRedirect(
              router,
              redirectPath,
              'Acesso negado',
              deniedMessage
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
            deniedMessage
          );
        }
      })();

      return () => {
        active = false;
      };
    }, [
      allowRoomManagers,
      allowTotemDevice,
      deniedMessage,
      redirectPath,
      requireMaintenance,
      router,
    ])
  );

  return status;
}
