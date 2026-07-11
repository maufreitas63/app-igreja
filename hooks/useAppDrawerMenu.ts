import { useCallback, useState } from 'react';
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
  sessionHasAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import { ACCESS_SCREEN } from '@/lib/accessScreen';
import { loadMaintenanceDashboardAccess } from '@/lib/maintenanceDashboardAccess';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';

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

  if (moduleKey === 'events_panel' || moduleKey === 'menu_redes_sociais') {
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
  const [items, setItems] = useState<AppDrawerMenuItemResolved[]>(() =>
    APP_DRAWER_MENU_ITEMS.map((item) => ({
      ...item,
      pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
      enabled:
        item.moduleKey === 'events_panel'
        || item.moduleKey === 'menu_redes_sociais'
        || isDrawerMenuPlaceholder(item.moduleKey),
    }))
  );
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canManageRooms, setCanManageRooms] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const phone = await getStoredUserPhone();
      const sessionProfile = phone ? await loadEffectiveSessionProfile(phone) : null;
      const profileId = sessionProfile?.id?.trim() ?? null;

      const [dashboardCardAccess, dashboardScreenAccess, maintenanceAccess, hasActiveMembership, roomAccess] =
        await Promise.all([
          profileId
            ? loadDashboardCardViewAccess(profileId)
            : Promise.resolve({} as DashboardCardViewAccess),
          profileId
            ? loadDashboardLinkedScreenAccess(profileId)
            : Promise.resolve({} as DashboardScreenAccess),
          loadMaintenanceDashboardAccess(),
          profileId ? fetchProfileHasActiveMembership(profileId) : Promise.resolve(false),
          sessionHasAccess('screen', ACCESS_SCREEN.configuracaoSalas, 'view'),
        ]);

      const superAdmin = maintenanceAccess.isSuperAdmin === true;
      setIsSuperAdmin(superAdmin);
      setCanManageRooms(superAdmin || roomAccess === true);

      const context = {
        dashboardCardAccess,
        dashboardScreenAccess,
        maintenancePanelAccess: maintenanceAccess.maintenancePanelAccess,
        canAccessMaintenance: maintenanceAccess.allowed,
        canOperateGhostMode: maintenanceAccess.canOperateGhostMode,
        canOpenAccessControl: maintenanceAccess.canOpenAccessControlCard,
        hasActiveMembership,
        isSuperAdmin: superAdmin,
      };

      const resolved = APP_DRAWER_MENU_ITEMS.map((item) => ({
        ...item,
        pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
        enabled: isDrawerModuleEnabled(item.moduleKey, context),
      }));

      setItems(resolved);
    } catch (error) {
      console.error('Erro ao carregar menu lateral:', error);
      setIsSuperAdmin(false);
      setCanManageRooms(false);
      setItems(
        APP_DRAWER_MENU_ITEMS.map((item) => ({
          ...item,
          pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
          enabled:
            item.moduleKey === 'events_panel'
            || item.moduleKey === 'menu_redes_sociais'
            || isDrawerMenuPlaceholder(item.moduleKey),
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, refresh, isSuperAdmin, canManageRooms };
}
