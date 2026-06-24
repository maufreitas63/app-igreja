export type MaintenancePanelContent =
  | 'events'
  | 'events_gantt'
  | 'sala_monitor'
  | 'quorum_presence'
  | 'scale_types'
  | 'scale_volunteers'
  | 'scales'
  | 'pastoral_care'
  | 'mudanca_papeis'
  | 'profile_cadastro'
  | 'family_reception'
  | 'financials'
  | 'predictive_insights'
  | 'relatorios'
  | 'access_control'
  | 'profile_access_insights'
  | 'event_orchestration';

export type MaintenanceShortcutIconName =
  | 'calendar'
  | 'bars'
  | 'building'
  | 'check-square-o'
  | 'tags'
  | 'users'
  | 'clipboard'
  | 'heart'
  | 'exchange'
  | 'line-chart'
  | 'area-chart'
  | 'file-text-o'
  | 'id-card'
  | 'home'
  | 'shield'
  | 'history'
  | 'bullhorn';

/** Ícone FontAwesome por módulo de manutenção. */
export const MAINTENANCE_SHORTCUT_ICONS: Record<
  MaintenancePanelContent,
  MaintenanceShortcutIconName
> = {
  events: 'calendar',
  events_gantt: 'bars',
  sala_monitor: 'building',
  quorum_presence: 'check-square-o',
  scale_types: 'tags',
  scale_volunteers: 'users',
  scales: 'clipboard',
  pastoral_care: 'heart',
  mudanca_papeis: 'exchange',
  financials: 'line-chart',
  predictive_insights: 'area-chart',
  relatorios: 'file-text-o',
  profile_cadastro: 'id-card',
  family_reception: 'home',
  access_control: 'shield',
  profile_access_insights: 'history',
  event_orchestration: 'bullhorn',
};

/** Cor do ícone alinhada à borda temática de cada painel. */
export const MAINTENANCE_SHORTCUT_ICON_COLORS: Record<MaintenancePanelContent, string> = {
  events: '#FBBF24',
  events_gantt: '#A5B4FC',
  sala_monitor: '#67E8F9',
  quorum_presence: '#60A5FA',
  scale_types: '#A5B4FC',
  scale_volunteers: '#2DD4BF',
  scales: '#34D399',
  pastoral_care: '#F472B6',
  mudanca_papeis: '#FB7185',
  financials: '#34D399',
  predictive_insights: '#22D3EE',
  relatorios: '#C084FC',
  profile_cadastro: '#A78BFA',
  family_reception: '#34D399',
  access_control: '#818CF8',
  profile_access_insights: '#FCD34D',
  event_orchestration: '#38BDF8',
};

export const MAINTENANCE_SHORTCUT_ICON_ACTIVE_COLOR = '#E0E7FF';
