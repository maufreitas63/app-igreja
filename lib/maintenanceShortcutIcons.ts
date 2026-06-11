export type MaintenancePanelContent =
  | 'events'
  | 'events_gantt'
  | 'sala_monitor'
  | 'quorum_presence'
  | 'scale_types'
  | 'scale_volunteers'
  | 'scales'
  | 'pastoral_care'
  | 'profile_cadastro'
  | 'family_reception'
  | 'financials'
  | 'access_control';

export type MaintenanceShortcutIconName =
  | 'calendar'
  | 'bars'
  | 'building'
  | 'check-square-o'
  | 'tags'
  | 'users'
  | 'clipboard'
  | 'heart'
  | 'line-chart'
  | 'id-card'
  | 'home'
  | 'shield';

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
  financials: 'line-chart',
  profile_cadastro: 'id-card',
  family_reception: 'home',
  access_control: 'shield',
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
  financials: '#34D399',
  profile_cadastro: '#A78BFA',
  family_reception: '#34D399',
  access_control: '#818CF8',
};

export const MAINTENANCE_SHORTCUT_ICON_ACTIVE_COLOR = '#E0E7FF';
