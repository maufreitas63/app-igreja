import {
  ACCESS_SCREEN,
  checkOperatorIsSuperAdmin,
  isDashboardCardContentAllowed,
  profileHasAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import { getCachedOrFetch } from '@/lib/asyncResultCache';
import { DASHBOARD_CARD_LINKED_SCREEN } from '@/lib/dashboardCardScreenLinks';

export type DashboardScreenAccess = Record<string, boolean>;

/** Telas filhas do card Perfil & Identidade — liberam o card mesmo sem `dashboard.card.grouped_manage`. */
const GROUPED_MANAGE_LINKED_SCREENS = [
  ACCESS_SCREEN.manageProfile,
  ACCESS_SCREEN.manageMembers,
] as const;

const loadDashboardLinkedScreenKeys = () =>
  [...new Set([...Object.values(DASHBOARD_CARD_LINKED_SCREEN), ...GROUPED_MANAGE_LINKED_SCREENS])];

export const getDashboardLinkedScreenKeys = loadDashboardLinkedScreenKeys;

const isGroupedManageCardAllowed = (
  cardAccess: DashboardCardViewAccess,
  screenAccess: DashboardScreenAccess
) => {
  if (isDashboardCardContentAllowed('grouped_manage', cardAccess)) {
    return true;
  }

  return GROUPED_MANAGE_LINKED_SCREENS.some((resourceKey) => screenAccess[resourceKey] === true);
};

/** Consulta ACL das telas filhas vinculadas a cards do dashboard. */
export async function loadDashboardLinkedScreenAccess(
  profileId: string,
  options?: { forceRefresh?: boolean }
): Promise<DashboardScreenAccess> {
  const screenKeys = loadDashboardLinkedScreenKeys();

  if (await checkOperatorIsSuperAdmin(options)) {
    return Object.fromEntries(screenKeys.map((resourceKey) => [resourceKey, true] as const));
  }

  return getCachedOrFetch(
    `dashboard:screens:${profileId}`,
    async () => {
      const entries = await Promise.all(
        screenKeys.map(async (resourceKey) => {
          const allowed = await profileHasAccess(profileId, 'screen', resourceKey, 'view');
          return [resourceKey, allowed] as const;
        })
      );

      return Object.fromEntries(entries);
    },
    { scopeId: profileId, forceRefresh: options?.forceRefresh }
  );
}

/** Card visível no carrossel somente quando card e tela filha (se houver) permitem acesso. */
export const isDashboardCardFullyAllowed = (
  content: string,
  cardAccess: DashboardCardViewAccess,
  screenAccess: DashboardScreenAccess
) => {
  if (content === 'grouped_manage') {
    return isGroupedManageCardAllowed(cardAccess, screenAccess);
  }

  if (!isDashboardCardContentAllowed(content, cardAccess)) {
    return false;
  }

  const linkedScreen = DASHBOARD_CARD_LINKED_SCREEN[content];

  if (linkedScreen && screenAccess[linkedScreen] !== true) {
    return false;
  }

  return true;
};
