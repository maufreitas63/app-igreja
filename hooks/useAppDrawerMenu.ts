import {
  APP_DRAWER_MENU_ITEMS,
  resolveDrawerDashboardCard,
  resolveDrawerMaintenancePanel,
  type AppDrawerMenuItem,
  type AppDrawerModuleKey,
} from '@/lib/appDrawerMenu';
import {
  isDashboardCardFullyAllowed,
  loadDashboardLinkedScreenAccess,
  type DashboardScreenAccess,
} from '@/lib/dashboardScreenAccess';
import {
  loadDashboardCardViewAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import { resolveDashboardCardContentFromParam } from '@/lib/dashboardCardScreenLinks';
import { loadMaintenanceDashboardAccess } from '@/lib/maintenanceDashboardAccess';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { useCallback, useEffect, useState } from 'react';

async function isDrawerModuleVisible(
  moduleKey: AppDrawerModuleKey,
  context: {
    dashboardCardAccess: DashboardCardViewAccess;
    dashboardScreenAccess: DashboardScreenAccess;
    maintenancePanelAccess: Record<string, boolean>;
    hasActiveMembership: boolean;
    canAccessMaintenance: boolean;
    canOperateGhostMode: boolean;
    canOpenAccessControl: boolean;
  }
): Promise<boolean> {
  if (moduleKey === 'events_panel') {
    return true;
  }

  const dashboardCard = resolveDrawerDashboardCard(moduleKey);

  if (dashboardCard) {
    if (moduleKey === 'administrativo' && !context.hasActiveMembership) {
      return false;
    }

    const content = resolveDashboardCardContentFromParam(dashboardCard);

    if (!content) {
      return false;
    }

    return isDashboardCardFullyAllowed(
      content,
      context.dashboardCardAccess,
      context.dashboardScreenAccess
    );
  }

  const panel = resolveDrawerMaintenancePanel(moduleKey);

  if (!panel) {
    return false;
  }

  if (!context.canAccessMaintenance) {
    return false;
  }

  if (moduleKey === 'auditor') {
    return context.canOperateGhostMode;
  }

  if (moduleKey === 'access_control') {
    return context.canOpenAccessControl;
  }

  return context.maintenancePanelAccess[panel] === true;
}

export function useAppDrawerMenu() {
  const [items, setItems] = useState<AppDrawerMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const phone = await getStoredUserPhone();
      const sessionProfile = phone ? await loadEffectiveSessionProfile(phone) : null;
      const profileId = sessionProfile?.id?.trim() ?? null;

      const [dashboardCardAccess, dashboardScreenAccess, maintenanceAccess, hasActiveMembership] =
        await Promise.all([
          profileId
            ? loadDashboardCardViewAccess(profileId)
            : Promise.resolve({} as DashboardCardViewAccess),
          profileId
            ? loadDashboardLinkedScreenAccess(profileId)
            : Promise.resolve({} as DashboardScreenAccess),
          loadMaintenanceDashboardAccess(),
          profileId ? fetchProfileHasActiveMembership(profileId) : Promise.resolve(false),
        ]);

      const context = {
        dashboardCardAccess,
        dashboardScreenAccess,
        maintenancePanelAccess: maintenanceAccess.maintenancePanelAccess,
        hasActiveMembership,
        canAccessMaintenance: maintenanceAccess.allowed,
        canOperateGhostMode: maintenanceAccess.canOperateGhostMode,
        canOpenAccessControl: maintenanceAccess.canOpenAccessControlCard,
      };

      const visible: AppDrawerMenuItem[] = [];

      for (const item of APP_DRAWER_MENU_ITEMS) {
        if (await isDrawerModuleVisible(item.moduleKey, context)) {
          visible.push(item);
        }
      }

      setItems(visible);
    } catch (error) {
      console.error('Erro ao carregar menu lateral:', error);
      setItems([APP_DRAWER_MENU_ITEMS[0]]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
