import { ACCESS_SCREEN } from '@/lib/accessControl';
import { DASHBOARD_FINANCIAL_CARD_ID } from '@/lib/financialModule';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { withMinimalPresentation, withReturnDashboardCard } from '@/lib/dashboardReturnNavigation';
import type { Router } from 'expo-router';

/** Itens do menu reservados para futura associação de rota (sem navegação ativa). */
export const DRAWER_MENU_PLACEHOLDER_KEYS = [] as const;

export type AppDrawerPlaceholderModuleKey = (typeof DRAWER_MENU_PLACEHOLDER_KEYS)[number];

/** Chave interna do módulo (mapeamento a–z da especificação). */
export type AppDrawerModuleKey =
  | 'events_panel'
  | 'menu_perfil'
  | 'menu_escalas'
  | 'menu_aniversariantes'
  | 'menu_membros'
  | 'menu_administrativo'
  | AppDrawerPlaceholderModuleKey
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
  { letter: 'b', label: 'Perfil', moduleKey: 'menu_perfil' },
  { letter: 'c', label: 'Financeiro', moduleKey: 'gestao_financeira' },
  { letter: 'd', label: 'Escalas', moduleKey: 'menu_escalas' },
  { letter: 'e', label: 'Aniversariantes', moduleKey: 'menu_aniversariantes' },
  { letter: 'f', label: 'Lista de Membros', moduleKey: 'menu_membros' },
  { letter: 'g', label: 'Administrativo', moduleKey: 'menu_administrativo' },
  {
    letter: 'h',
    label: 'Programação de Eventos',
    moduleKey: 'Events',
    dividerBefore: true,
  },
  { letter: 'i', label: 'Cronograma de Eventos', moduleKey: 'Event_gantt' },
  { letter: 'j', label: 'Orquestração do Evento', moduleKey: 'event_orchestration' },
  { letter: 'k', label: 'Sala(s) - Check In', moduleKey: 'sala_servidor' },
  { letter: 'l', label: 'Tipos de Escala', moduleKey: 'scales_type' },
  { letter: 'm', label: 'Servos em Disponibilidade', moduleKey: 'scales_volunteers' },
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

export function isDrawerMenuPlaceholder(moduleKey: AppDrawerModuleKey): moduleKey is AppDrawerPlaceholderModuleKey {
  return (DRAWER_MENU_PLACEHOLDER_KEYS as readonly string[]).includes(moduleKey);
}

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
  if (isDrawerMenuPlaceholder(moduleKey)) {
    return;
  }

  if (moduleKey === 'menu_perfil') {
    router.push({
      pathname: '/perfil',
      params: withMinimalPresentation(),
    });
    return;
  }

  if (moduleKey === 'menu_escalas') {
    router.push({
      pathname: '/escalas',
      params: withMinimalPresentation(),
    });
    return;
  }

  if (moduleKey === 'menu_aniversariantes') {
    router.push({
      pathname: '/aniversariantes',
      params: withMinimalPresentation(),
    });
    return;
  }

  if (moduleKey === 'menu_membros') {
    router.push({
      pathname: '/membros',
      params: withMinimalPresentation(),
    });
    return;
  }

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

  if (moduleKey === 'menu_administrativo') {
    router.push({
      pathname: '/administrativo',
      params: withMinimalPresentation(),
    });
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
