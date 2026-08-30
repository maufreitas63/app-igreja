import { useCallback, useEffect, useState } from 'react';
import {
  APP_DRAWER_MENU_ITEMS,
  APP_DRAWER_SETTINGS_ITEMS,
  DISCIPLESHIP_SETTINGS_MODULE_KEYS,
  isDrawerMenuPlaceholder,
  resolveDrawerMaintenancePanel,
  type AppDrawerMenuItem,
  type AppDrawerModuleKey,
  type AppDrawerSettingsItem,
} from '@/lib/appDrawerMenu';
import {
  isDrawerMaintenanceModuleAllowed,
  isDrawerMemberModuleAllowed,
  isDrawerSuggestionsImprovementsAllowed,
  DRAWER_MEMBER_CARD_BY_MODULE,
  DRAWER_MEMBER_SCREEN_BY_MODULE,
} from '@/lib/drawerMenuAccess';
import {
  loadDashboardLinkedScreenAccess,
  type DashboardScreenAccess,
} from '@/lib/dashboardScreenAccess';
import {
  ACCESS_SCREEN,
  loadDashboardCardViewAccess,
  sessionHasAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import { getGhostModeState, isGhostModeActive, subscribeGhostMode } from '@/lib/ghostMode';
import { loadMaintenanceDashboardAccess } from '@/lib/maintenanceDashboardAccess';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';

export type AppDrawerMenuItemResolved = AppDrawerMenuItem & {
  enabled: boolean;
  pendingRoute: boolean;
};

export type AppDrawerSettingsItemResolved = AppDrawerSettingsItem & {
  enabled: boolean;
  pendingRoute: boolean;
};

type DrawerEnableContext = {
  dashboardCardAccess: DashboardCardViewAccess;
  dashboardScreenAccess: DashboardScreenAccess;
  maintenancePanelAccess: Record<string, boolean>;
  canAccessMaintenance: boolean;
  canOperateGhostMode: boolean;
  canOpenAccessControl: boolean;
  canManageRooms: boolean;
  canManageMediaAuthorization: boolean;
  canAccessPastoralCare: boolean;
  hasActiveMembership: boolean;
  isSuperAdmin: boolean;
};

const SETTINGS_PEOPLE_OPS_KEYS: ReadonlySet<AppDrawerModuleKey> = new Set([
  'menu_membros',
  'menu_mapa',
  'menu_aniversariantes',
  'menu_administrativo',
]);

function isDrawerModuleEnabled(
  moduleKey: AppDrawerModuleKey,
  context: DrawerEnableContext,
  catalog: 'member' | 'settings'
): boolean {
  if (isDrawerMenuPlaceholder(moduleKey)) {
    return true;
  }

  if (moduleKey === 'events_panel' || moduleKey === 'menu_redes_sociais' || moduleKey === 'menu_sobre_conecta') {
    return true;
  }

  if (moduleKey === 'menu_igrejas') {
    // Proteção aplicada: Gestor não tem visibilidade do Super Administrador
    return context.isSuperAdmin;
  }

  // Ghost: só canOperateGhostMode (RPC = super_admin OU grant maintenance.card.auditor).
  // Não reutilizar isSuperAdmin de cache — evita vazar o menu a outros usuários no mesmo app.
  if (moduleKey === 'auditor') {
    return context.canOperateGhostMode;
  }

  if (catalog === 'settings' && SETTINGS_PEOPLE_OPS_KEYS.has(moduleKey)) {
    if (!context.canAccessMaintenance && !context.isSuperAdmin) {
      return false;
    }
  }

  if (catalog === 'settings' && DISCIPLESHIP_SETTINGS_MODULE_KEYS.has(moduleKey)) {
    if (moduleKey === 'discipleship_reset') {
      return context.isSuperAdmin;
    }

    return (
      context.isSuperAdmin
      || context.canAccessPastoralCare
      || isDrawerMaintenanceModuleAllowed(moduleKey, resolveDrawerMaintenancePanel(moduleKey), {
          canAccessMaintenance: context.canAccessMaintenance,
          maintenancePanelAccess: context.maintenancePanelAccess,
          canOperateGhostMode: context.canOperateGhostMode,
          canOpenAccessControl: context.canOpenAccessControl,
          canManageRooms: context.canManageRooms,
          canManageMediaAuthorization: context.canManageMediaAuthorization,
          isSuperAdmin: context.isSuperAdmin,
        })
    );
  }

  if (moduleKey === 'menu_mapa') {
    return (
      context.dashboardScreenAccess[ACCESS_SCREEN.mapGeolocation] === true
      && context.hasActiveMembership
    );
  }

  if (moduleKey === 'suggestions_improvements') {
    return isDrawerSuggestionsImprovementsAllowed({
      dashboardCardAccess: context.dashboardCardAccess,
      dashboardScreenAccess: context.dashboardScreenAccess,
      hasActiveMembership: context.hasActiveMembership,
      maintenancePanelAccess: context.maintenancePanelAccess,
    });
  }

  if (moduleKey in DRAWER_MEMBER_CARD_BY_MODULE || moduleKey in DRAWER_MEMBER_SCREEN_BY_MODULE) {
    return isDrawerMemberModuleAllowed(moduleKey, {
      dashboardCardAccess: context.dashboardCardAccess,
      dashboardScreenAccess: context.dashboardScreenAccess,
      hasActiveMembership: context.hasActiveMembership,
    });
  }

  const panel = resolveDrawerMaintenancePanel(moduleKey);

  return isDrawerMaintenanceModuleAllowed(moduleKey, panel, {
    canAccessMaintenance: context.canAccessMaintenance,
    maintenancePanelAccess: context.maintenancePanelAccess,
    canOperateGhostMode: context.canOperateGhostMode,
    canOpenAccessControl: context.canOpenAccessControl,
    canManageRooms: context.canManageRooms,
    canManageMediaAuthorization: context.canManageMediaAuthorization,
    isSuperAdmin: context.isSuperAdmin,
  });
}

const MEMBER_FALLBACK_KEYS: ReadonlySet<AppDrawerModuleKey> = new Set([
  'events_panel',
  'menu_redes_sociais',
  'menu_sobre_conecta',
]);

export function useAppDrawerMenu() {
  const [items, setItems] = useState<AppDrawerMenuItemResolved[]>(() =>
    APP_DRAWER_MENU_ITEMS.map((item) => ({
      ...item,
      pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
      enabled: MEMBER_FALLBACK_KEYS.has(item.moduleKey) || isDrawerMenuPlaceholder(item.moduleKey),
    }))
  );
  const [settingsItems, setSettingsItems] = useState<AppDrawerSettingsItemResolved[]>(() =>
    APP_DRAWER_SETTINGS_ITEMS.map((item) => ({
      ...item,
      pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
      enabled: false,
    }))
  );
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const ghostActive = isGhostModeActive();
      const profileId =
        (await resolveEffectiveProfileId({ forceRefresh: ghostActive }))
        ?? (await loadEffectiveSessionProfile())?.id?.trim()
        ?? null;

      const [dashboardCardAccess, dashboardScreenAccess, maintenanceAccess, hasActiveMembership, roomAccess, mediaAuthAccess] =
        await Promise.all([
          profileId
            ? loadDashboardCardViewAccess(profileId, { forceRefresh: ghostActive })
            : Promise.resolve({} as DashboardCardViewAccess),
          profileId
            ? loadDashboardLinkedScreenAccess(profileId, { forceRefresh: ghostActive })
            : Promise.resolve({} as DashboardScreenAccess),
          loadMaintenanceDashboardAccess({ forceRefresh: ghostActive }),
          profileId ? fetchProfileHasActiveMembership(profileId) : Promise.resolve(false),
          sessionHasAccess('screen', ACCESS_SCREEN.configuracaoSalas, 'view'),
          sessionHasAccess('screen', ACCESS_SCREEN.autorizacaoMidia, 'view'),
        ]);

      const extraScreenEntries = await Promise.all(
        [
          ACCESS_SCREEN.discipleshipTrail,
          ACCESS_SCREEN.expenseReport,
          ACCESS_SCREEN.mapGeolocation,
          ACCESS_SCREEN.generosityMural,
        ].map(async (resourceKey) => {
          if (dashboardScreenAccess[resourceKey] === true) {
            return [resourceKey, true] as const;
          }
          const allowed = await sessionHasAccess('screen', resourceKey, 'view');
          return [resourceKey, allowed === true] as const;
        })
      );

      const mergedScreenAccess: DashboardScreenAccess = {
        ...dashboardScreenAccess,
        ...Object.fromEntries(extraScreenEntries),
      };

      const superAdmin = maintenanceAccess.isSuperAdmin === true;
      const canManageRooms = superAdmin || roomAccess === true;
      setIsSuperAdmin(superAdmin);

      const context: DrawerEnableContext = {
        dashboardCardAccess,
        dashboardScreenAccess: mergedScreenAccess,
        maintenancePanelAccess: maintenanceAccess.maintenancePanelAccess,
        canAccessMaintenance: maintenanceAccess.allowed,
        canOperateGhostMode: maintenanceAccess.canOperateGhostMode,
        canOpenAccessControl: maintenanceAccess.canOpenAccessControlCard,
        canManageRooms,
        canManageMediaAuthorization: superAdmin || mediaAuthAccess === true,
        canAccessPastoralCare: maintenanceAccess.canAccessPastoralCare === true,
        hasActiveMembership,
        isSuperAdmin: superAdmin,
      };

      setItems(
        APP_DRAWER_MENU_ITEMS.map((item) => ({
          ...item,
          pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
          enabled: isDrawerModuleEnabled(item.moduleKey, context, 'member'),
        }))
      );
      setSettingsItems(
        APP_DRAWER_SETTINGS_ITEMS.map((item) => ({
          ...item,
          pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
          enabled: isDrawerModuleEnabled(item.moduleKey, context, 'settings'),
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar menu lateral:', error);
      setIsSuperAdmin(false);
      setItems(
        APP_DRAWER_MENU_ITEMS.map((item) => ({
          ...item,
          pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
          enabled:
            MEMBER_FALLBACK_KEYS.has(item.moduleKey) || isDrawerMenuPlaceholder(item.moduleKey),
        }))
      );
      setSettingsItems(
        APP_DRAWER_SETTINGS_ITEMS.map((item) => ({
          ...item,
          pendingRoute: isDrawerMenuPlaceholder(item.moduleKey),
          enabled: false,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let previousTarget = getGhostModeState()?.targetProfileId ?? null;

    return subscribeGhostMode(() => {
      const nextTarget = getGhostModeState()?.targetProfileId ?? null;
      if (nextTarget !== previousTarget) {
        previousTarget = nextTarget;
        void refresh();
      }
    });
  }, [refresh]);

  const canAccessSettings = settingsItems.some((item) => item.enabled);

  return {
    items,
    settingsItems,
    loading,
    refresh,
    isSuperAdmin,
    canAccessSettings,
  };
}
