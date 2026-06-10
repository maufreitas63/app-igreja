import {
  isDashboardCardContentAllowed,
  profileHasAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import { DASHBOARD_CARD_LINKED_SCREEN } from '@/lib/dashboardCardScreenLinks';

export type DashboardScreenAccess = Record<string, boolean>;

/** Consulta ACL das telas filhas vinculadas a cards do dashboard. */
export async function loadDashboardLinkedScreenAccess(
  profileId: string
): Promise<DashboardScreenAccess> {
  const screenKeys = [...new Set(Object.values(DASHBOARD_CARD_LINKED_SCREEN))];

  const entries = await Promise.all(
    screenKeys.map(async (resourceKey) => {
      const allowed = await profileHasAccess(profileId, 'screen', resourceKey, 'view');
      return [resourceKey, allowed] as const;
    })
  );

  return Object.fromEntries(entries);
}

/** Card visível no carrossel somente quando card e tela filha (se houver) permitem acesso. */
export const isDashboardCardFullyAllowed = (
  content: string,
  cardAccess: DashboardCardViewAccess,
  screenAccess: DashboardScreenAccess
) => {
  if (!isDashboardCardContentAllowed(content, cardAccess)) {
    return false;
  }

  const linkedScreen = DASHBOARD_CARD_LINKED_SCREEN[content];

  if (linkedScreen && screenAccess[linkedScreen] !== true) {
    return false;
  }

  return true;
};
