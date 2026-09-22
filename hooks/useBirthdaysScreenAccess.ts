import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';

/** Acesso à rota `/aniversariantes` — exige card dashboard.card.birthdays. */
export function useBirthdaysScreenAccess(redirectPath: string = MEMBER_HOME_PATH): ScreenAccessStatus {
  return useDashboardCardRouteAccess({
    resourceKey: ACCESS_DASHBOARD_CARD.birthdays,
    deniedMessage: 'Você não tem permissão para abrir Aniversariantes.',
    requireActiveMembership: true,
    redirectPath,
  });
}
