export type MaintenancePanelContent =
  | 'events'
  | 'events_gantt'
  | 'sala_servidor'
  | 'quorum_presence'
  | 'scale_types'
  | 'scale_volunteers'
  | 'scales'
  | 'pastoral_care'
  | 'small_groups_management'
  | 'campaigns_management'
  | 'volunteer_mural'
  | 'mudanca_papeis'
  | 'transferencia_igreja'
  | 'profile_cadastro'
  | 'family_reception'
  | 'visitor_followup'
  | 'financials'
  | 'predictive_insights'
  | 'relatorios'
  | 'access_control'
  | 'profile_access_insights'
  | 'auditor'
  | 'event_orchestration'
  | 'suggestions_improvements';

export type MaintenanceShortcutIconName =
  | 'calendar'
  | 'bars'
  | 'building'
  | 'check-square-o'
  | 'tags'
  | 'users'
  | 'clipboard'
  | 'heart'
  | 'group'
  | 'exchange'
  | 'share'
  | 'line-chart'
  | 'area-chart'
  | 'file-text-o'
  | 'id-card'
  | 'home'
  | 'handshake-o'
  | 'shield'
  | 'history'
  | 'bullhorn'
  | 'comments'
  | 'flag'
  | 'user-secret';

/** Ícone FontAwesome por módulo de manutenção. */
export const MAINTENANCE_SHORTCUT_ICONS: Record<
  MaintenancePanelContent,
  MaintenanceShortcutIconName
> = {
  events: 'calendar',
  events_gantt: 'bars',
  sala_servidor: 'building',
  quorum_presence: 'check-square-o',
  scale_types: 'tags',
  scale_volunteers: 'users',
  scales: 'clipboard',
  pastoral_care: 'heart',
  small_groups_management: 'group',
  campaigns_management: 'flag',
  volunteer_mural: 'users',
  mudanca_papeis: 'exchange',
  transferencia_igreja: 'share',
  financials: 'line-chart',
  predictive_insights: 'area-chart',
  relatorios: 'file-text-o',
  profile_cadastro: 'id-card',
  family_reception: 'home',
  visitor_followup: 'handshake-o',
  access_control: 'shield',
  profile_access_insights: 'history',
  auditor: 'user-secret',
  event_orchestration: 'bullhorn',
  suggestions_improvements: 'comments',
};

/** Cor do ícone alinhada à borda temática de cada painel. */
export const MAINTENANCE_SHORTCUT_ICON_COLORS: Record<MaintenancePanelContent, string> = {
  events: '#FBBF24',
  events_gantt: '#A5B4FC',
  sala_servidor: '#67E8F9',
  quorum_presence: '#60A5FA',
  scale_types: '#A5B4FC',
  scale_volunteers: '#2DD4BF',
  scales: '#34D399',
  pastoral_care: '#F472B6',
  small_groups_management: '#A78BFA',
  campaigns_management: '#F59E0B',
  volunteer_mural: '#0D9488',
  mudanca_papeis: '#FB7185',
  transferencia_igreja: '#818CF8',
  financials: '#34D399',
  predictive_insights: '#22D3EE',
  relatorios: '#C084FC',
  profile_cadastro: '#A78BFA',
  family_reception: '#34D399',
  visitor_followup: '#F59E0B',
  access_control: '#818CF8',
  profile_access_insights: '#FCD34D',
  auditor: '#FB7185',
  event_orchestration: '#38BDF8',
  suggestions_improvements: '#38BDF8',
};

export const MAINTENANCE_SHORTCUT_ICON_ACTIVE_COLOR = '#E0E7FF';
