import {
  APP_DRAWER_MENU_ITEMS,
  isDrawerMenuPlaceholder,
  resolveDrawerMaintenancePanel,
  type AppDrawerMenuItem,
  type AppDrawerModuleKey,
} from '@/lib/appDrawerMenu';
import {
  isDrawerMaintenanceModuleAllowed,
  isDrawerMemberModuleAllowed,
  isDrawerSuggestionsImprovementsAllowed,
  DRAWER_MEMBER_CARD_BY_MODULE,
} from '@/lib/drawerMenuAccess';
import {
  loadDashboardLinkedScreenAccess,
  type DashboardScreenAccess,
} from '@/lib/dashboardScreenAccess';
import {
  loadDashboardCardViewAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import { loadMaintenanceDashboardAccess } from '@/lib/maintenanceDashboardAccess';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { useCallback, useEffect, useState } from 'react';

export type AppDrawerMenuItemResolved = AppDrawerMenuItem & {
  enabled: boolean;
  pendingRoute: boolean;
};

function isDrawerModuleEnabled(
  moduleKey: AppDrawerModuleKey,
  context: {
    dashboardCardAccess: DashboardCardViewAccess;
    dashboardScreenAccess: DashboardScreenAccess;
    maintenancePanelAccess: Record<string, boolean>;
    canAccessMaintenance: boolean;
    canOperateGhostMode: boolean;
    canOpenAccessControl: boolean;
    hasActiveMembership: boolean;
    isSuperAdmin: boolean;
  }
): boolean {
  if (isDrawerMenuPlaceholder(moduleKey)) {
    return true;
  }

  if (moduleKey === 'events_panel') {
    return true;
  }

  if (moduleKey === 'menu_igrejas') {
    return context.isSuperAdmin;
  }

  if (moduleKey in DRAWER_MEMBER_CARD_BY_MODULE) {
    return isDrawerMemberModuleAllowed(moduleKey, {
      dashboardCardAccess: context.dashboardCardAccess,
      dashboardScreenAccess: context.dashboardScreenAccess,
      hasActiveMembership: context.hasActiveMembership,
    });
  }

  if (moduleKey === 'suggestions_improvements') {
    return isDrawerSuggestionsImprovementsAllowed({
      dashboardCardAccess: context.dashboardCardAccess,
      dashboardScreenAccess: context.dashboardScreenAccess,
      hasActiveMembership: context.hasActiveMembership,
      maintenancePanelAccess: context.maintenancePanelAccess,
    });
  }

  const panel = resolveDrawerMaintenancePanel(moduleKey);

  return isDrawerMaintenanceModuleAllowed(moduleKey, panel, {
    canAccessMaintenance: context.canAccessMaintenance,
    maintenancePanelAccess: context.maintenancePanelAccess,
    canOperateGhostMode: context.canOperateGhostMode,
    canOpenAccessControl: context.canOpenAccessControl,
  });
}

export function useAppDrawerMenu() {
  const [items, setItems] = useState<AppDrawerMenuItemResolved[]>([]);
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
        canAccessMaintenance: maintenanceAccess.allowed,
        canOperateGhostMode: maintenanceAccess.canOperateGhostMode,
        canOpenAccessControl: maintenanceAccess.canOpenAccessControlCard,
        hasActiveMembership,
        isSuperAdmin: maintenanceAccess.isSuperAdmin === true,
      };

      const resolved = APP_DRAWER_MENU_ITEMS.map((item) => ({
        ...item,
        pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
        enabled: isDrawerModuleEnabled(item.moduleKey, context),
      }));

      setItems(resolved);
    } catch (error) {
      console.error('Erro ao carregar menu lateral:', error);
      setItems(
        APP_DRAWER_MENU_ITEMS.map((item) => ({
          ...item,
          pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
          enabled: item.moduleKey === 'events_panel' || isDrawerMenuPlaceholder(item.moduleKey),
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
