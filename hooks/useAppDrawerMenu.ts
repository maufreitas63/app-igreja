import {
  APP_DRAWER_MENU_ITEMS,
  isDrawerMenuPlaceholder,
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
import { loadMaintenanceDashboardAccess } from '@/lib/maintenanceDashboardAccess';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { useCallback, useEffect, useState } from 'react';

export type AppDrawerMenuItemResolved = AppDrawerMenuItem & {
  enabled: boolean;
  pendingRoute: boolean;
};

async function isDrawerModuleEnabled(
  moduleKey: AppDrawerModuleKey,
  context: {
    dashboardCardAccess: DashboardCardViewAccess;
    dashboardScreenAccess: DashboardScreenAccess;
    maintenancePanelAccess: Record<string, boolean>;
    canAccessMaintenance: boolean;
    canOperateGhostMode: boolean;
    canOpenAccessControl: boolean;
  }
): Promise<boolean> {
  if (isDrawerMenuPlaceholder(moduleKey)) {
    return true;
  }

  if (moduleKey === 'events_panel') {
    return true;
  }

  if (moduleKey === 'gestao_financeira') {
    return isDashboardCardFullyAllowed(
      'financial',
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
  const [items, setItems] = useState<AppDrawerMenuItemResolved[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const phone = await getStoredUserPhone();
      const sessionProfile = phone ? await loadEffectiveSessionProfile(phone) : null;
      const profileId = sessionProfile?.id?.trim() ?? null;

      const [dashboardCardAccess, dashboardScreenAccess, maintenanceAccess] = await Promise.all([
        profileId
          ? loadDashboardCardViewAccess(profileId)
          : Promise.resolve({} as DashboardCardViewAccess),
        profileId
          ? loadDashboardLinkedScreenAccess(profileId)
          : Promise.resolve({} as DashboardScreenAccess),
        loadMaintenanceDashboardAccess(),
      ]);

      const context = {
        dashboardCardAccess,
        dashboardScreenAccess,
        maintenancePanelAccess: maintenanceAccess.maintenancePanelAccess,
        canAccessMaintenance: maintenanceAccess.allowed,
        canOperateGhostMode: maintenanceAccess.canOperateGhostMode,
        canOpenAccessControl: maintenanceAccess.canOpenAccessControlCard,
      };

      const resolved = await Promise.all(
        APP_DRAWER_MENU_ITEMS.map(async (item) => ({
          ...item,
          pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
          enabled: await isDrawerModuleEnabled(item.moduleKey, context),
        }))
      );

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
