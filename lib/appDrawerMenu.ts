import { ACCESS_DASHBOARD_CARD, ACCESS_SCREEN } from '@/lib/accessControl';
import { DASHBOARD_FINANCIAL_CARD_ID } from '@/lib/financialModule';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import {
  withMinimalPresentation,
  withReturnDashboardCard,
} from '@/lib/dashboardReturnNavigation';
import {
  FAIL_CLOSED_REDIRECT_PATH,
  MEMBER_HOME_PATH,
  withFailClosedReturn,
  withMemberCardReturn,
} from '@/lib/failClosedNavigation';
import { markDrawerNavigation } from '@/lib/drawerNavigationIntent';
import type { Href, Router } from 'expo-router';

/** Itens do menu reservados para futura associação de rota (sem navegação ativa). */
export const DRAWER_MENU_PLACEHOLDER_KEYS = [] as const;

export type AppDrawerPlaceholderModuleKey = (typeof DRAWER_MENU_PLACEHOLDER_KEYS)[number];

/** Chave interna do módulo (mapeamento a–z da especificação). */
export type AppDrawerModuleKey =
  | 'events_panel'
  | 'menu_perfil'
  | 'menu_manage_profile'
  | 'menu_manage_members'
  | 'menu_ofertas'
  | 'menu_campaigns'
  | 'menu_expense_report'
  | 'menu_pastoral'
  | 'menu_trilha'
  | 'menu_small_group'
  | 'menu_opportunity_mural'
  | 'menu_generosity_mural'
  | 'menu_escalas'
  | 'menu_aniversariantes'
  | 'menu_membros'
  | 'menu_mapa'
  | 'menu_administrativo'
  | 'menu_igrejas'
  | 'menu_alianca'
  | 'menu_redes_sociais'
  | 'menu_sobre_conecta'
  | 'menu_billing'
  | 'menu_salas'
  | 'menu_totem'
  | 'menu_autorizacao_midia'
  | 'menu_orquestrador'
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
  | 'small_groups_management'
  | 'campaigns_management'
  | 'volunteer_mural'
  | 'generosity_moderation'
  | 'discipleship_themes'
  | 'discipleship_alerts'
  | 'discipleship_reset'
  | 'financials'
  | 'predictive_insights'
  | 'relatorios'
  | 'suggestions_improvements'
  | 'quorum_presence'
  | 'profile_cadastro'
  | 'family_reception'
  | 'visitor_followup'
  | 'access_control'
  | 'mudanca_papeis'
  | 'transferencia_igreja'
  | 'profile_access_insights'
  | 'auditor';

export type AppDrawerMenuItem = {
  letter: string;
  label: string;
  moduleKey: AppDrawerModuleKey;
  /** Linha divisória imediatamente antes deste item. */
  dividerBefore?: boolean;
};

export type AppDrawerSettingsGroupId =
  | 'operacao'
  | 'pessoas'
  | 'culto'
  | 'financas'
  | 'governanca';

export type AppDrawerSettingsItem = AppDrawerMenuItem & {
  group: AppDrawerSettingsGroupId;
  hint?: string;
};

export const APP_DRAWER_SETTINGS_GROUPS: { id: AppDrawerSettingsGroupId; title: string }[] = [
  { id: 'operacao', title: 'Operação e Segurança' },
  { id: 'pessoas', title: 'Gestão de Pessoas' },
  { id: 'culto', title: 'Culto e Eventos' },
  { id: 'financas', title: 'Finanças e Inteligência' },
  { id: 'governanca', title: 'Governança e TI' },
];

export const SCALE_VOLUNTEERS_MENU_LABEL = 'Servos em Disponibilidade';
export const SCALE_SCHEDULING_MENU_LABEL = 'Programação de Escalas';

export const DISCIPLESHIP_SETTINGS_MODULE_KEYS: ReadonlySet<AppDrawerModuleKey> = new Set([
  'discipleship_themes',
  'discipleship_alerts',
  'discipleship_reset',
]);

/** Menu lateral principal — apenas autonomia do membro e da família. */
export const APP_DRAWER_MENU_ITEMS: AppDrawerMenuItem[] = [
  { letter: 'a', label: 'Início', moduleKey: 'events_panel' },
  { letter: 'b', label: 'Perfil', moduleKey: 'menu_perfil' },
  { letter: 'c', label: 'Financeiro', moduleKey: 'gestao_financeira' },
  { letter: 'd', label: 'Minha Célula', moduleKey: 'menu_small_group' },
  { letter: 'e', label: 'Escalas', moduleKey: 'menu_escalas' },
  { letter: 'f', label: 'Mural de Oportunidades', moduleKey: 'menu_opportunity_mural' },
  { letter: 'f2', label: 'Mural de Generosidade', moduleKey: 'menu_generosity_mural' },
  { letter: 'g', label: 'Sugestões', moduleKey: 'suggestions_improvements' },
  { letter: 'h', label: 'Redes Sociais', moduleKey: 'menu_redes_sociais' },
  { letter: 'i', label: 'Sobre o Conecta+', moduleKey: 'menu_sobre_conecta' },
];

/** Painel da engrenagem — orquestração e gestão (ACL de liderança). */
export const APP_DRAWER_SETTINGS_ITEMS: AppDrawerSettingsItem[] = [
  {
    letter: 's1',
    label: 'Configuração de salas',
    moduleKey: 'menu_salas',
    group: 'operacao',
    hint: 'Nomes afetivos e atribuição de membros',
  },
  {
    letter: 's2',
    label: 'Totem de check-in',
    moduleKey: 'menu_totem',
    group: 'operacao',
    hint: 'Leitor de QR no hall',
  },
  {
    letter: 's3',
    label: 'Autorização de imagem e voz',
    moduleKey: 'menu_autorizacao_midia',
    group: 'operacao',
    hint: 'Termos LGPD e confirmação por e-mail',
  },
  {
    letter: 'p1',
    label: 'Lista de Membros',
    moduleKey: 'menu_membros',
    group: 'pessoas',
    hint: 'Diretório da comunidade',
  },
  {
    letter: 'p2',
    label: 'Mapa de geolocalização',
    moduleKey: 'menu_mapa',
    group: 'pessoas',
    hint: 'Pins das famílias no mapa',
  },
  {
    letter: 'p3',
    label: 'Aniversariantes',
    moduleKey: 'menu_aniversariantes',
    group: 'pessoas',
  },
  {
    letter: 'p4',
    label: 'Cuidados Pastorais',
    moduleKey: 'pastoral_care',
    group: 'pessoas',
    hint: 'Fila e slots',
  },
  {
    letter: 'p5',
    label: 'Gestão de Pequenos Grupos',
    moduleKey: 'small_groups_management',
    group: 'pessoas',
  },
  {
    letter: 'p6',
    label: 'Mural de Voluntários',
    moduleKey: 'volunteer_mural',
    group: 'pessoas',
  },
  {
    letter: 'p6b',
    label: 'Moderação do Mural',
    moduleKey: 'generosity_moderation',
    group: 'pessoas',
    hint: 'Doações e pedidos de empréstimo',
  },
  {
    letter: 'p7',
    label: 'Recepção Familiar',
    moduleKey: 'family_reception',
    group: 'pessoas',
  },
  {
    letter: 'p7b',
    label: 'Régua de Acolhimento',
    moduleKey: 'visitor_followup',
    group: 'pessoas',
    hint: 'Tarefas da equipe de boas-vindas',
  },
  {
    letter: 'p8',
    label: 'Cadastro de Usuário',
    moduleKey: 'profile_cadastro',
    group: 'pessoas',
  },
  {
    letter: 'p9',
    label: 'Administrativo',
    moduleKey: 'menu_administrativo',
    group: 'pessoas',
    hint: 'Atos constitutivos',
  },
  {
    letter: 'c1',
    label: 'Programação de Eventos',
    moduleKey: 'Events',
    group: 'culto',
  },
  {
    letter: 'c2',
    label: 'Cronograma de Eventos',
    moduleKey: 'Event_gantt',
    group: 'culto',
  },
  {
    letter: 'c3',
    label: 'Manutenção de Avisos',
    moduleKey: 'event_orchestration',
    group: 'culto',
    hint: 'Comunicados da home',
  },
  {
    letter: 'c4',
    label: 'Sala(s) - Check In',
    moduleKey: 'sala_servidor',
    group: 'culto',
  },
  {
    letter: 'c5',
    label: 'Tipos de Escala',
    moduleKey: 'scales_type',
    group: 'culto',
  },
  {
    letter: 'c6',
    label: SCALE_VOLUNTEERS_MENU_LABEL,
    moduleKey: 'scales_volunteers',
    group: 'culto',
  },
  {
    letter: 'c7',
    label: SCALE_SCHEDULING_MENU_LABEL,
    moduleKey: 'scales',
    group: 'culto',
  },
  {
    letter: 'c8',
    label: 'Presença',
    moduleKey: 'quorum_presence',
    group: 'culto',
  },
  {
    letter: 'c9',
    label: 'Orquestrador',
    moduleKey: 'menu_orquestrador',
    group: 'culto',
    hint: 'Painel de avisos em tela cheia',
  },
  {
    letter: 'f1',
    label: 'Informações Financeiras',
    moduleKey: 'financials',
    group: 'financas',
    hint: 'Extratos, RD e orçamento',
  },
  {
    letter: 'f2',
    label: 'Gestão de Campanhas',
    moduleKey: 'campaigns_management',
    group: 'financas',
  },
  {
    letter: 'f3',
    label: 'Modelo Preditivo',
    moduleKey: 'predictive_insights',
    group: 'financas',
  },
  {
    letter: 'g1',
    label: 'Temas da Trilha',
    moduleKey: 'discipleship_themes',
    group: 'governanca',
    hint: 'Textos, vídeos e reflexões dos passos',
  },
  {
    letter: 'g2',
    label: 'Trilha — Reconhecimentos',
    moduleKey: 'discipleship_alerts',
    group: 'governanca',
    hint: 'Alunos 100% prontos para certificado',
  },
  {
    letter: 'g3',
    label: 'Resetar Trilha',
    moduleKey: 'discipleship_reset',
    group: 'governanca',
    hint: 'Reiniciar progresso de um usuário nesta igreja',
  },
  {
    letter: 'g4',
    label: 'Relatórios',
    moduleKey: 'relatorios',
    group: 'governanca',
  },
  {
    letter: 'g5',
    label: 'Controle de Acesso',
    moduleKey: 'access_control',
    group: 'governanca',
  },
  {
    letter: 'g6',
    label: 'Mudança Papéis',
    moduleKey: 'mudanca_papeis',
    group: 'governanca',
  },
  {
    letter: 'g7',
    label: 'Transferência de Membro',
    moduleKey: 'transferencia_igreja',
    group: 'governanca',
  },
  {
    letter: 'g8',
    label: 'Acesso Usuários',
    moduleKey: 'profile_access_insights',
    group: 'governanca',
  },
  {
    letter: 'g9',
    label: 'Modo Ghost',
    moduleKey: 'auditor',
    group: 'governanca',
  },
  {
    letter: 'g10',
    label: 'Assinaturas',
    moduleKey: 'menu_billing',
    group: 'governanca',
    hint: 'Planos e cobrança da igreja',
  },
  {
    letter: 'g10b',
    label: 'Aliança Conecta Reino',
    moduleKey: 'menu_alianca',
    group: 'governanca',
    hint: 'Indicações, passivo de 40% e baixa manual das ofertas',
  },
  {
    letter: 'g11',
    label: 'Instâncias (Igrejas)',
    moduleKey: 'menu_igrejas',
    group: 'governanca',
    hint: 'Criar e alternar ambientes de igreja',
  },
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
  small_groups_management: 'small_groups_management',
  campaigns_management: 'campaigns_management',
  volunteer_mural: 'volunteer_mural',
  generosity_moderation: 'generosity_moderation',
  discipleship_themes: 'discipleship_themes',
  discipleship_alerts: 'discipleship_alerts',
  discipleship_reset: 'discipleship_reset',
  financials: 'financials',
  predictive_insights: 'predictive_insights',
  relatorios: 'relatorios',
  suggestions_improvements: 'suggestions_improvements',
  quorum_presence: 'quorum_presence',
  profile_cadastro: 'profile_cadastro',
  family_reception: 'family_reception',
  visitor_followup: 'visitor_followup',
  access_control: 'access_control',
  mudanca_papeis: 'mudanca_papeis',
  transferencia_igreja: 'transferencia_igreja',
  profile_access_insights: 'profile_access_insights',
  auditor: 'auditor',
};

export function resolveDrawerMaintenancePanel(moduleKey: AppDrawerModuleKey) {
  return MAINTENANCE_PANEL_BY_MODULE[moduleKey] ?? null;
}

function openScreen(
  router: Router,
  pathname: Href,
  params?: Record<string, string>
) {
  router.navigate({
    pathname,
    params: params ?? withFailClosedReturn(),
  } as Href);
}

const DRAWER_NAVIGATE = { method: 'navigate' as const };

export async function navigateDrawerMenuItem(
  router: Router,
  moduleKey: AppDrawerModuleKey
) {
  markDrawerNavigation();

  if (isDrawerMenuPlaceholder(moduleKey)) {
    return;
  }

  if (moduleKey === 'events_panel') {
    router.replace(MEMBER_HOME_PATH);
    return;
  }

  if (moduleKey === 'menu_perfil') {
    openScreen(router, '/perfil', withMemberCardReturn('grouped_manage'));
    return;
  }

  if (moduleKey === 'menu_manage_profile') {
    await navigateWithScreenAccess(
      router,
      '/manage-profile',
      ACCESS_SCREEN.manageProfile,
      withMemberCardReturn('grouped_manage'),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_manage_members') {
    await navigateWithScreenAccess(
      router,
      '/manage-members',
      ACCESS_SCREEN.manageMembers,
      withMemberCardReturn('grouped_manage'),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_ofertas') {
    openScreen(router, '/ofertas', withMemberCardReturn('offerings'));
    return;
  }

  if (moduleKey === 'menu_campaigns') {
    openScreen(
      router,
      '/ofertas',
      withMemberCardReturn('campaign_card', { campaignContribute: '1' })
    );
    return;
  }

  if (moduleKey === 'menu_expense_report') {
    await navigateWithScreenAccess(
      router,
      '/expense-report',
      ACCESS_SCREEN.expenseReport,
      withFailClosedReturn(),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_pastoral') {
    await navigateWithScreenAccess(
      router,
      '/pastoral',
      ACCESS_SCREEN.pastoral,
      withMemberCardReturn('pastoral'),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_trilha') {
    await navigateWithScreenAccess(
      router,
      '/trilha-discipulado',
      ACCESS_SCREEN.discipleshipTrail,
      withFailClosedReturn(),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_small_group') {
    await navigateWithScreenAccess(
      router,
      '/pequeno-grupo',
      ACCESS_DASHBOARD_CARD.smallGroup,
      withFailClosedReturn(),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_opportunity_mural') {
    await navigateWithScreenAccess(
      router,
      '/mural-oportunidades',
      ACCESS_DASHBOARD_CARD.opportunities,
      withFailClosedReturn(),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_generosity_mural') {
    await navigateWithScreenAccess(
      router,
      '/mural-generosidade',
      ACCESS_SCREEN.generosityMural,
      withFailClosedReturn(),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_escalas') {
    openScreen(router, '/escalas', withMemberCardReturn('vigilance_scales'));
    return;
  }

  if (moduleKey === 'menu_aniversariantes') {
    openScreen(router, '/aniversariantes', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_membros') {
    openScreen(router, '/membros', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_mapa') {
    await navigateWithScreenAccess(
      router,
      '/mapa-geolocalizacao',
      ACCESS_SCREEN.mapGeolocation,
      withFailClosedReturn(),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'gestao_financeira') {
    await navigateWithScreenAccess(
      router,
      '/financial',
      ACCESS_SCREEN.financial,
      withReturnDashboardCard(DASHBOARD_FINANCIAL_CARD_ID),
      DRAWER_NAVIGATE
    );
    return;
  }

  if (moduleKey === 'menu_administrativo') {
    openScreen(router, '/administrativo', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_igrejas') {
    openScreen(router, '/igrejas', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_alianca') {
    openScreen(router, '/alianca-conecta-reino', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_billing') {
    openScreen(router, '/billing', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_salas') {
    openScreen(router, '/configuracao-salas', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_totem') {
    openScreen(router, '/totem-checkin', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_autorizacao_midia') {
    openScreen(router, '/autorizacao-midia', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_orquestrador') {
    openScreen(router, '/admin/orquestrador', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_redes_sociais') {
    openScreen(router, '/redes-sociais', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'menu_sobre_conecta') {
    openScreen(router, '/sobre-conecta', withFailClosedReturn());
    return;
  }

  if (moduleKey === 'suggestions_improvements') {
    openScreen(
      router,
      '/suggestions-improvements',
      withFailClosedReturn()
    );
    return;
  }

  const maintenancePanel = resolveDrawerMaintenancePanel(moduleKey);

  if (maintenancePanel) {
    router.navigate({
      pathname: '/maintenance-dashboard',
      params: withMinimalPresentation({
        panel: maintenancePanel,
        returnRoute: FAIL_CLOSED_REDIRECT_PATH,
      }),
    });
  }
}
