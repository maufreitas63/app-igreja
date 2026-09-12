import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import type { Href } from 'expo-router';

function maintenancePanel(panel: string) {
  return `maintenance-dashboard?panel=${panel}` as const;
}

/** Chaves estáveis ligadas à rota visível (não à URL crua com query extra). */
export const KNOWLEDGE_ROUTE = {
  home: 'home',
  perfil: '/perfil',
  ofertas: '/ofertas',
  pastoral: '/pastoral',
  escalas: '/escalas',
  financial: '/financial',
  login: 'login',
  sair: 'sair',
  avisos: '/avisos',
  primiciasMember: '/primicias',
  trilha: '/trilha-discipulado',
  expenseReport: '/expense-report',
  redesSociais: '/redes-sociais',
  sobre: '/sobre-conecta',
  pequenoGrupo: '/pequeno-grupo',
  muralOportunidades: '/mural-oportunidades',
  muralGenerosidade: '/mural-generosidade',
  alianca: '/alianca-conecta-reino',
  igrejas: '/igrejas',
  totem: '/totem-checkin',
  billing: '/billing',
  salas: '/configuracao-salas',
  autorizacaoMidia: '/autorizacao-midia',
  membros: '/membros',
  mapa: '/mapa-geolocalizacao',
  aniversariantes: '/aniversariantes',
  administrativo: '/administrativo',
  livros: '/livros-doados',
  suggestions: '/suggestions-improvements',
  relatorios: maintenancePanel('relatorios'),
  mudancaPapeis: maintenancePanel('mudanca_papeis'),
  auditor: maintenancePanel('auditor'),
  accessControl: maintenancePanel('access_control'),
  financialsPanel: maintenancePanel('financials'),
  events: maintenancePanel('events'),
  eventsGantt: maintenancePanel('events_gantt'),
  eventOrchestration: maintenancePanel('event_orchestration'),
  pastoralCare: maintenancePanel('pastoral_care'),
  smallGroupsAdmin: maintenancePanel('small_groups_management'),
  volunteerMuralAdmin: maintenancePanel('volunteer_mural'),
  generosityModeration: maintenancePanel('generosity_moderation'),
  familyReception: maintenancePanel('family_reception'),
  visitorFollowup: maintenancePanel('visitor_followup'),
  profileCadastro: maintenancePanel('profile_cadastro'),
  campaigns: maintenancePanel('campaigns_management'),
  primicias: maintenancePanel('primicias_management'),
  predictive: maintenancePanel('predictive_insights'),
  scaleTypes: maintenancePanel('scale_types'),
  scaleVolunteers: maintenancePanel('scale_volunteers'),
  scalesAdmin: maintenancePanel('scales'),
  quorumPresence: maintenancePanel('quorum_presence'),
  discipleshipThemes: maintenancePanel('discipleship_themes'),
  discipleshipAlerts: maintenancePanel('discipleship_alerts'),
  discipleshipReset: maintenancePanel('discipleship_reset'),
  transferencia: maintenancePanel('transferencia_igreja'),
  profileAccessInsights: maintenancePanel('profile_access_insights'),
} as const;

export type KnowledgeRouteKey = (typeof KNOWLEDGE_ROUTE)[keyof typeof KNOWLEDGE_ROUTE];

export const KNOWLEDGE_ROLE_OPTIONS: { code: string; label: string }[] = [
  { code: 'member', label: 'Membro' },
  { code: 'congregado', label: 'Congregado' },
  { code: 'visitante', label: 'Visitante' },
  { code: 'visitantes', label: 'Visitantes' },
  { code: 'pastoral', label: 'Pastoral' },
  { code: 'tesoureiro', label: 'Tesoureiro' },
  { code: 'secretaria', label: 'Secretaria' },
  { code: 'events_admin', label: 'Eventos' },
  { code: 'gestor_controle_acesso', label: 'Gestor de acesso' },
  { code: 'super_admin', label: 'Super Administrador' },
];

const MAINTENANCE_PANEL_PREFIX = 'maintenance-dashboard?panel=';

/** Rotas do catálogo do menu do membro (o que o usuário acessa no dia a dia). */
export const MEMBER_KNOWLEDGE_ROUTE_KEYS: ReadonlySet<string> = new Set([
  KNOWLEDGE_ROUTE.home,
  KNOWLEDGE_ROUTE.login,
  KNOWLEDGE_ROUTE.sair,
  KNOWLEDGE_ROUTE.perfil,
  KNOWLEDGE_ROUTE.ofertas,
  KNOWLEDGE_ROUTE.pastoral,
  KNOWLEDGE_ROUTE.escalas,
  KNOWLEDGE_ROUTE.financial,
  KNOWLEDGE_ROUTE.pequenoGrupo,
  KNOWLEDGE_ROUTE.muralOportunidades,
  KNOWLEDGE_ROUTE.muralGenerosidade,
  KNOWLEDGE_ROUTE.suggestions,
  KNOWLEDGE_ROUTE.avisos,
  KNOWLEDGE_ROUTE.primiciasMember,
  KNOWLEDGE_ROUTE.trilha,
  KNOWLEDGE_ROUTE.expenseReport,
  KNOWLEDGE_ROUTE.redesSociais,
  KNOWLEDGE_ROUTE.sobre,
  KNOWLEDGE_ROUTE.livros,
]);

export type KnowledgeCatalog = 'member' | 'maintenance';

export function knowledgeCatalogFromParam(value: unknown): KnowledgeCatalog {
  const raw = Array.isArray(value) ? String(value[0] || '') : String(value || '');
  return raw.trim().toLowerCase() === 'manutencao' ? 'maintenance' : 'member';
}

export function knowledgeRouteHref(routeKey: string): Href | null {
  if (routeKey.startsWith(MAINTENANCE_PANEL_PREFIX)) {
    const panel = routeKey.slice(MAINTENANCE_PANEL_PREFIX.length).trim();
    if (!panel) return null;
    return {
      pathname: '/maintenance-dashboard',
      params: { panel },
    } as Href;
  }

  switch (routeKey) {
    case KNOWLEDGE_ROUTE.home:
      return MEMBER_HOME_PATH;
    default:
      if (routeKey.startsWith('/')) {
        return routeKey as Href;
      }
      return null;
  }
}
