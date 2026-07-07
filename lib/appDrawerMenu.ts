import { ACCESS_SCREEN } from '@/lib/accessControl';
import { DASHBOARD_FINANCIAL_CARD_ID } from '@/lib/financialModule';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { withMinimalPresentation, withReturnDashboardCard } from '@/lib/dashboardReturnNavigation';
import type { Router } from 'expo-router';

/** Chave interna do módulo (mapeamento a–z da especificação). */
export type AppDrawerModuleKey =
  | 'events_panel'
  | 'gestao_financeira'
  | 'Events'
  | 'Event_gantt'
  | 'event_orchestration'
  | 'sala_servidor'
  | 'scales_type'
  | 'scales_volunteers'
  | 'scales'
  | 'pastoral_care'
  | 'financials'
  | 'predictive_insights'
  | 'relatorios'
  | 'suggestions_improvements'
  | 'quorum_presence'
  | 'profile_cadastro'
  | 'family_reception'
  | 'access_control'
  | 'mudanca_papeis'
  | 'profile_access_insights'
  | 'auditor';

export type AppDrawerMenuItem = {
  letter: string;
  label: string;
  moduleKey: AppDrawerModuleKey;
  /** Linha divisória imediatamente antes deste item. */
  dividerBefore?: boolean;
};

export const APP_DRAWER_MENU_ITEMS: AppDrawerMenuItem[] = [
  { letter: 'a', label: 'Início', moduleKey: 'events_panel' },
  { letter: 'c', label: 'Financeiro', moduleKey: 'gestao_financeira' },
  {
    letter: 'h',
    label: 'Programação de Eventos',
    moduleKey: 'Events',
    dividerBefore: true,
  },
  { letter: 'i', label: 'Cronograma', moduleKey: 'Event_gantt' },
  { letter: 'j', label: 'Orquestração', moduleKey: 'event_orchestration' },
  { letter: 'k', label: 'Salas', moduleKey: 'sala_servidor' },
  { letter: 'l', label: 'Tipos Escala', moduleKey: 'scales_type' },
  { letter: 'm', label: 'Servos', moduleKey: 'scales_volunteers' },
  { letter: 'n', label: 'Prog. Escalas', moduleKey: 'scales' },
  { letter: 'o', label: 'Cuidados Pastorais', moduleKey: 'pastoral_care' },
  { letter: 'p', label: 'Info Financeiras', moduleKey: 'financials' },
  { letter: 'q', label: 'Modelo Preditivo', moduleKey: 'predictive_insights' },
  { letter: 'r', label: 'Relatórios', moduleKey: 'relatorios' },
  { letter: 's', label: 'Sugestões', moduleKey: 'suggestions_improvements' },
  { letter: 't', label: 'Presença', moduleKey: 'quorum_presence' },
  { letter: 'u', label: 'Cadastro', moduleKey: 'profile_cadastro' },
  { letter: 'v', label: 'Recepção Familiar', moduleKey: 'family_reception' },
  { letter: 'w', label: 'Controle Acesso', moduleKey: 'access_control' },
  { letter: 'x', label: 'Mudança Papéis', moduleKey: 'mudanca_papeis' },
  { letter: 'y', label: 'Acesso Usuários', moduleKey: 'profile_access_insights' },
  { letter: 'z', label: 'Modo Ghost', moduleKey: 'auditor' },
];

const MAINTENANCE_PANEL_BY_MODULE: Partial<Record<AppDrawerModuleKey, string>> = {
  Events: 'events',
  Event_gantt: 'events_gantt',
  event_orchestration: 'event_orchestration',
  sala_servidor: 'sala_servidor',
  scales_type: 'scale_types',
  scales_volunteers: 'scale_volunteers',
  scales: 'scales',
  pastoral_care: 'pastoral_care',
  financials: 'financials',
  predictive_insights: 'predictive_insights',
  relatorios: 'relatorios',
  suggestions_improvements: 'suggestions_improvements',
  quorum_presence: 'quorum_presence',
  profile_cadastro: 'profile_cadastro',
  family_reception: 'family_reception',
  access_control: 'access_control',
  mudanca_papeis: 'mudanca_papeis',
  profile_access_insights: 'profile_access_insights',
  auditor: 'auditor',
};

export function resolveDrawerMaintenancePanel(moduleKey: AppDrawerModuleKey) {
  return MAINTENANCE_PANEL_BY_MODULE[moduleKey] ?? null;
}

export async function navigateDrawerMenuItem(
  router: Router,
  moduleKey: AppDrawerModuleKey
) {
  if (moduleKey === 'events_panel') {
    router.replace('/(tabs)');
    return;
  }

  if (moduleKey === 'gestao_financeira') {
    await navigateWithScreenAccess(
      router,
      '/financial',
      ACCESS_SCREEN.financial,
      withReturnDashboardCard(DASHBOARD_FINANCIAL_CARD_ID),
      { method: 'push' }
    );
    return;
  }

  if (moduleKey === 'suggestions_improvements') {
    router.push({
      pathname: '/suggestions-improvements',
      params: withMinimalPresentation(),
    });
    return;
  }

  const maintenancePanel = resolveDrawerMaintenancePanel(moduleKey);

  if (maintenancePanel) {
    router.push({
      pathname: '/maintenance-dashboard',
      params: withMinimalPresentation({ panel: maintenancePanel }),
    });
  }
}
