import type { AppDrawerModuleKey } from '@/lib/appDrawerMenu';
import {
  ACCESS_DASHBOARD_CARD,
  isDashboardCardContentAllowed,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import {
  isDashboardCardFullyAllowed,
  type DashboardScreenAccess,
} from '@/lib/dashboardScreenAccess';

/** Card do dashboard (content) vinculado a cada item do menu lateral — membro. */
export const DRAWER_MEMBER_CARD_BY_MODULE: Partial<Record<AppDrawerModuleKey, string>> = {
  menu_perfil: 'grouped_manage',
  gestao_financeira: 'financial',
  menu_escalas: 'vigilance_scales',
  menu_aniversariantes: 'birthdays',
  menu_membros: 'members_list',
  menu_administrativo: 'administrativo',
};

/** Itens do menu membro que exigem vínculo ativo (`membership_out` visível no app). */
export const DRAWER_MODULES_REQUIRING_ACTIVE_MEMBERSHIP: ReadonlySet<AppDrawerModuleKey> = new Set([
  'menu_escalas',
  'menu_aniversariantes',
  'menu_membros',
  'menu_administrativo',
]);

export type DrawerMemberAccessContext = {
  dashboardCardAccess: DashboardCardViewAccess;
  dashboardScreenAccess: DashboardScreenAccess;
  hasActiveMembership: boolean;
};

export type DrawerMaintenanceAccessContext = {
  canAccessMaintenance: boolean;
  maintenancePanelAccess: Record<string, boolean>;
  canOperateGhostMode: boolean;
  canOpenAccessControl: boolean;
};

/** Mesma regra dos hooks `use*ScreenAccess` para rotas do menu membro. */
export function isDrawerMemberModuleAllowed(
  moduleKey: AppDrawerModuleKey,
  context: DrawerMemberAccessContext
): boolean {
  const cardContent = DRAWER_MEMBER_CARD_BY_MODULE[moduleKey];

  if (!cardContent) {
    return false;
  }

  if (
    !isDashboardCardFullyAllowed(
      cardContent,
      context.dashboardCardAccess,
      context.dashboardScreenAccess
    )
  ) {
    return false;
  }

  if (DRAWER_MODULES_REQUIRING_ACTIVE_MEMBERSHIP.has(moduleKey) && !context.hasActiveMembership) {
    return false;
  }

  return true;
}

/** Alinhado a `useSuggestionsImprovementsAccess`: painel manutenção OU administrativo + membro ativo. */
export function isSuggestionsImprovementsAccessAllowed(options: {
  hasAdministrativoCard: boolean;
  hasMaintenancePanel: boolean;
  hasActiveMembership: boolean;
}): boolean {
  return options.hasMaintenancePanel || (options.hasAdministrativoCard && options.hasActiveMembership);
}

/** Alinhado a `useSuggestionsImprovementsAccess`: painel manutenção OU administrativo + membro ativo. */
export function isDrawerSuggestionsImprovementsAllowed(
  context: DrawerMemberAccessContext & Pick<DrawerMaintenanceAccessContext, 'maintenancePanelAccess'>
): boolean {
  return isSuggestionsImprovementsAccessAllowed({
    hasMaintenancePanel: context.maintenancePanelAccess.suggestions_improvements === true,
    hasAdministrativoCard: isDashboardCardContentAllowed('administrativo', context.dashboardCardAccess),
    hasActiveMembership: context.hasActiveMembership,
  });
}

export function isDrawerMaintenanceModuleAllowed(
  moduleKey: AppDrawerModuleKey,
  panel: string | null,
  context: DrawerMaintenanceAccessContext
): boolean {
  if (!panel || !context.canAccessMaintenance) {
    return false;
  }

  if (moduleKey === 'auditor') {
    return context.canOperateGhostMode;
  }

  if (moduleKey === 'access_control') {
    return context.canOpenAccessControl;
  }

  if (moduleKey === 'suggestions_improvements') {
    return context.maintenancePanelAccess.suggestions_improvements === true;
  }

  return context.maintenancePanelAccess[panel] === true;
}

export const DRAWER_OFFERINGS_RESOURCE = ACCESS_DASHBOARD_CARD.offerings;
export const DRAWER_PASTORAL_RESOURCE = ACCESS_DASHBOARD_CARD.pastoral;
export const DRAWER_EVENT_ORCHESTRATOR_RESOURCE = 'maintenance.card.event_orchestration';
