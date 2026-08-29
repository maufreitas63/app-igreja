import {
  withReturnDashboardCard,
  withReturnRoute,
} from '@/lib/dashboardReturnNavigation';

/**
 * Destino fail-closed: membro comum barrado em rota administrativa
 * (URL direta, grant ausente ou ACL indisponível).
 */
export const FAIL_CLOSED_REDIRECT_PATH = '/(tabs)';

/** Home do membro (Eu quero… / início). */
export const MEMBER_HOME_PATH = '/(tabs)';

export function withFailClosedReturn(extra: Record<string, string> = {}) {
  return withReturnRoute(FAIL_CLOSED_REDIRECT_PATH, extra);
}

export function withMemberCardReturn(
  returnDashboardCard: string,
  extra: Record<string, string> = {}
) {
  return withReturnDashboardCard(returnDashboardCard, extra);
}
