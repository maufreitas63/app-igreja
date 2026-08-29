import type { AppDrawerModuleKey } from '@/lib/appDrawerMenu';
import {
  ACCESS_DASHBOARD_CARD,
  ACCESS_SCREEN,
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
  menu_ofertas: 'offerings',
  menu_campaigns: 'campaign_card',
  menu_pastoral: 'pastoral',
  menu_small_group: 'small_group',
  menu_opportunity_mural: 'opportunity_mural_card',
  menu_generosity_mural: 'generosity_mural',
  menu_aniversariantes: 'birthdays',
  menu_membros: 'members_list',
  menu_administrativo: 'administrativo',
};

/** Telas com grant próprio (além ou no lugar do card do carrossel). */
export const DRAWER_MEMBER_SCREEN_BY_MODULE: Partial<Record<AppDrawerModuleKey, string>> = {
  menu_manage_profile: ACCESS_SCREEN.manageProfile,
  menu_manage_members: ACCESS_SCREEN.manageMembers,
  menu_trilha: ACCESS_SCREEN.discipleshipTrail,
  menu_expense_report: ACCESS_SCREEN.expenseReport,
  menu_generosity_mural: ACCESS_SCREEN.generosityMural,
};

/** Itens do menu membro que exigem vínculo ativo (`membership_out` visível no app). */
export const DRAWER_MODULES_REQUIRING_ACTIVE_MEMBERSHIP: ReadonlySet<AppDrawerModuleKey> = new Set([
  'menu_escalas',
  'menu_aniversariantes',
  'menu_membros',
  'menu_administrativo',
  'menu_mapa',
  'menu_small_group',
  'menu_opportunity_mural',
  'menu_generosity_mural',
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
  canManageRooms: boolean;
  isSuperAdmin: boolean;
};

/** Mesma regra dos hooks `use*ScreenAccess` para rotas do menu membro. */
export function isDrawerMemberModuleAllowed(
  moduleKey: AppDrawerModuleKey,
  context: DrawerMemberAccessContext
): boolean {
  const screenKey = DRAWER_MEMBER_SCREEN_BY_MODULE[moduleKey];
  const cardContent = DRAWER_MEMBER_CARD_BY_MODULE[moduleKey];
  const screenOk = Boolean(screenKey && context.dashboardScreenAccess[screenKey] === true);
  const cardOk = Boolean(
    cardContent
    && isDashboardCardFullyAllowed(
      cardContent,
      context.dashboardCardAccess,
      context.dashboardScreenAccess
    )
  );

  if (!screenOk && !cardOk) {
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

export function isDrawerOperatorToolAllowed(
  moduleKey: AppDrawerModuleKey,
  context: DrawerMaintenanceAccessContext
): boolean {
  const leadership = context.canAccessMaintenance || context.isSuperAdmin || context.canManageRooms;

  if (moduleKey === 'menu_salas') {
    return context.canManageRooms || context.isSuperAdmin;
  }

  if (moduleKey === 'menu_totem' || moduleKey === 'menu_autorizacao_midia') {
    return leadership;
  }

  if (moduleKey === 'menu_billing') {
    return context.isSuperAdmin || context.canAccessMaintenance;
  }

  if (moduleKey === 'menu_orquestrador') {
    return isDrawerMaintenanceModuleAllowed('event_orchestration', 'event_orchestration', context);
  }

  if (moduleKey === 'menu_mapa') {
    return false;
  }

  return false;
}

export function isDrawerMaintenanceModuleAllowed(
  moduleKey: AppDrawerModuleKey,
  panel: string | null,
  context: DrawerMaintenanceAccessContext
): boolean {
  if (isDrawerOperatorToolAllowed(moduleKey, context)) {
    return true;
  }

  if (moduleKey === 'menu_igrejas') {
    return context.isSuperAdmin;
  }

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
