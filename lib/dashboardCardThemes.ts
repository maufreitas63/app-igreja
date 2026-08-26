/** Cores do painel Escalas (referência visual: dashboard_card_vigilance_scales). */
export const VIGILANCE_SCALES_UI = {
  accent: '#3A96DD',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.55)',
  headerSurface: 'rgba(255, 255, 255, 0.55)',
  border: 'rgba(250, 250, 250, 1)',
  borderMuted: 'rgba(250, 250, 250, 1)',
} as const;

/** Paletas visuais dos cards do carrossel do dashboard. */
export type DashboardCardTheme = {
  backgroundColor: string;
  borderColor: string;
  shadowColor: string;
  accent: string;
  accentMuted: string;
};

/** Tema canônico compartilhado por todos os cards de dashboard. */
export const VIGILANCE_LIGHT_CARD_THEME: DashboardCardTheme = {
  backgroundColor: VIGILANCE_SCALES_UI.surface,
  borderColor: VIGILANCE_SCALES_UI.border,
  shadowColor: '#E8E8E8',
  accent: VIGILANCE_SCALES_UI.accent,
  accentMuted: VIGILANCE_SCALES_UI.accent,
};

/** @deprecated Use VIGILANCE_LIGHT_CARD_THEME — mantido para imports legados. */
export const DEFAULT_DASHBOARD_CARD_THEME = VIGILANCE_LIGHT_CARD_THEME;

/** Cores internas do card Aniversariantes (lista sobre o shell unificado). */
export const BIRTHDAYS_UI = {
  accent: VIGILANCE_SCALES_UI.accent,
  monthDropdownText: VIGILANCE_SCALES_UI.accent,
  monthDropdownBackground: VIGILANCE_SCALES_UI.surface,
  nameText: VIGILANCE_SCALES_UI.accent,
  dateText: VIGILANCE_SCALES_UI.accent,
  backgroundColor: VIGILANCE_LIGHT_CARD_THEME.backgroundColor,
  listBackground: VIGILANCE_SCALES_UI.surfaceHighlight,
  dateBadgeBackground: VIGILANCE_SCALES_UI.surface,
  border: VIGILANCE_SCALES_UI.border,
} as const;

/** Superfície clara para painéis do maintenance-dashboard. */
export const MAINTENANCE_LIGHT_PANEL_CARD = {
  backgroundColor: VIGILANCE_SCALES_UI.surface,
  borderColor: VIGILANCE_SCALES_UI.border,
} as const;

/** Todos os cards herdam o tema Escalas (vigilance_scales). */
export const DASHBOARD_CARD_THEMES = {
  event_alt: VIGILANCE_LIGHT_CARD_THEME,
  qr: VIGILANCE_LIGHT_CARD_THEME,
  kids_teens: VIGILANCE_LIGHT_CARD_THEME,
  offerings: VIGILANCE_LIGHT_CARD_THEME,
  pastoral: VIGILANCE_LIGHT_CARD_THEME,
  members_list: VIGILANCE_LIGHT_CARD_THEME,
  birthdays: VIGILANCE_LIGHT_CARD_THEME,
  financial: VIGILANCE_LIGHT_CARD_THEME,
  vigilance_scales: VIGILANCE_LIGHT_CARD_THEME,
  scale_roster: VIGILANCE_LIGHT_CARD_THEME,
  parking_vehicle_v2: VIGILANCE_LIGHT_CARD_THEME,
  grouped_manage: VIGILANCE_LIGHT_CARD_THEME,
  ministerial_profile: VIGILANCE_LIGHT_CARD_THEME,
  grouped_palette: VIGILANCE_LIGHT_CARD_THEME,
  administrativo: VIGILANCE_LIGHT_CARD_THEME,
  small_group: VIGILANCE_LIGHT_CARD_THEME,
  campaign_card: VIGILANCE_LIGHT_CARD_THEME,
  opportunity_mural_card: VIGILANCE_LIGHT_CARD_THEME,
} as const satisfies Record<string, DashboardCardTheme>;
