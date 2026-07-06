/** Cores do painel Escalas (seletor de tipo de escala). */
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

/** Tema claro compartilhado (cards Escalas, escalas associadas, etc.). */
export const VIGILANCE_LIGHT_CARD_THEME: DashboardCardTheme = {
  backgroundColor: VIGILANCE_SCALES_UI.surface,
  borderColor: VIGILANCE_SCALES_UI.border,
  shadowColor: '#E8E8E8',
  accent: VIGILANCE_SCALES_UI.accent,
  accentMuted: VIGILANCE_SCALES_UI.accent,
};

/** Cores do card Aniversariantes (fundo branco, textos azuis). */
export const BIRTHDAYS_UI = {
  accent: '#3A96DD',
  monthDropdownText: '#FFFFFF',
  nameText: '#FFFFFF',
  dateText: '#429BDF',
  backgroundColor: '#FFFFFF',
  listBackground: 'rgba(15, 23, 42, 0.3)',
  border: VIGILANCE_SCALES_UI.border,
} as const;

const BIRTHDAYS_CARD_THEME: DashboardCardTheme = {
  backgroundColor: BIRTHDAYS_UI.backgroundColor,
  borderColor: BIRTHDAYS_UI.border,
  shadowColor: '#E8E8E8',
  accent: BIRTHDAYS_UI.accent,
  accentMuted: BIRTHDAYS_UI.accent,
};

/** Superfície clara para painéis do maintenance-dashboard. */
export const MAINTENANCE_LIGHT_PANEL_CARD = {
  backgroundColor: VIGILANCE_SCALES_UI.surface,
  borderColor: VIGILANCE_SCALES_UI.border,
} as const;

export const DASHBOARD_CARD_THEMES = {
  event_alt: {
    backgroundColor: 'rgba(99, 102, 241, 0.24)',
    borderColor: '#818CF8',
    shadowColor: '#6366F1',
    accent: '#C7D2FE',
    accentMuted: '#A5B4FC',
  },
  qr: {
    backgroundColor: 'rgba(6, 182, 212, 0.22)',
    borderColor: '#22D3EE',
    shadowColor: '#0891B2',
    accent: '#A5F3FC',
    accentMuted: '#67E8F9',
  },
  kids_teens: {
    backgroundColor: 'rgba(244, 114, 182, 0.18)',
    borderColor: '#F9A8D4',
    shadowColor: '#DB2777',
    accent: '#FBCFE8',
    accentMuted: '#F472B6',
  },
  offerings: {
    backgroundColor: 'rgba(217, 119, 6, 0.22)',
    borderColor: '#FBBF24',
    shadowColor: '#D97706',
    accent: '#FDE68A',
    accentMuted: '#FCD34D',
  },
  pastoral: {
    backgroundColor: 'rgba(147, 51, 234, 0.26)',
    borderColor: '#C084FC',
    shadowColor: '#9333EA',
    accent: '#E9D5FF',
    accentMuted: '#D8B4FE',
  },
  members_list: VIGILANCE_LIGHT_CARD_THEME,
  birthdays: BIRTHDAYS_CARD_THEME,
  financial: {
    backgroundColor: 'rgba(5, 150, 105, 0.22)',
    borderColor: '#34D399',
    shadowColor: '#059669',
    accent: '#A7F3D0',
    accentMuted: '#6EE7B7',
  },
  vigilance_scales: VIGILANCE_LIGHT_CARD_THEME,
  scale_roster: VIGILANCE_LIGHT_CARD_THEME,
  parking_vehicle_v2: VIGILANCE_LIGHT_CARD_THEME,
  grouped_manage: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#60A5FA',
    shadowColor: '#2563EB',
    accent: '#BFDBFE',
    accentMuted: '#93C5FD',
  },
  ministerial_profile: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#34D399',
    shadowColor: '#059669',
    accent: '#A7F3D0',
    accentMuted: '#6EE7B7',
  },
  grouped_palette: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#60A5FA',
    shadowColor: '#2563EB',
    accent: '#BFDBFE',
    accentMuted: '#93C5FD',
  },
  administrativo: VIGILANCE_LIGHT_CARD_THEME,
} as const satisfies Record<string, DashboardCardTheme>;
