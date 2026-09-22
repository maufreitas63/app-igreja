import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';

/** Acesso à rota `/membros` — exige card dashboard.card.members_list. */
export function useMembersListsScreenAccess(redirectPath: string = MEMBER_HOME_PATH): ScreenAccessStatus {
  return useDashboardCardRouteAccess({
    resourceKey: ACCESS_DASHBOARD_CARD.membersList,
    deniedMessage: 'Você não tem permissão para abrir Membros.',
    requireActiveMembership: true,
    redirectPath,
  });
}
