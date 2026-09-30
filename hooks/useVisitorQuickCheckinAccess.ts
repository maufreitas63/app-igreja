import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';

/** Acesso à rota `/visitantes-cadastro-rapido` — card dashboard.card.visitor_quick_checkin. */
export function useVisitorQuickCheckinAccess(redirectPath: string = MEMBER_HOME_PATH): ScreenAccessStatus {
  return useDashboardCardRouteAccess({
    resourceKey: ACCESS_DASHBOARD_CARD.visitorQuickCheckin,
    deniedMessage: 'Você não tem permissão para o Cadastro Rápido de Visitantes.',
    requireActiveMembership: false,
    redirectPath,
  });
}
