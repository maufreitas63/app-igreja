import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';

/** Acesso à rota `/escalas` — exige card dashboard.card.vigilance_scales. */
export function useScalesScreenAccess(redirectPath: string = MEMBER_HOME_PATH): ScreenAccessStatus {
  return useDashboardCardRouteAccess({
    resourceKey: ACCESS_DASHBOARD_CARD.vigilanceScales,
    deniedMessage: 'Você não tem permissão para abrir Escalas.',
    requireActiveMembership: true,
    redirectPath,
  });
}
