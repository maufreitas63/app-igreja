import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';

/** Acesso à rota `/administrativo` — exige card dashboard.card.administrativo e membro ativo. */
export function useAdministrativoScreenAccess(redirectPath: string = MEMBER_HOME_PATH): ScreenAccessStatus {
  return useDashboardCardRouteAccess({
    resourceKey: ACCESS_DASHBOARD_CARD.administrativo,
    deniedMessage: 'Você não tem permissão para abrir Administrativo.',
    requireActiveMembership: true,
    redirectPath,
  });
}
