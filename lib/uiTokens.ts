import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const UI_COLORS = {
  textPrimary: '#F8FAFC',
  textMuted: '#94A3B8',
  textAccentEmerald: '#6EE7B7',
  textAccentAmber: '#FCD34D',
  borderMuted: '#334155',
  borderAccentEmerald: '#10B981',
  borderAccentAmber: '#FBBF24',
  surfaceCard: 'rgba(30, 41, 59, 0.7)',
  surfaceElevated: 'rgba(15, 23, 42, 0.88)',
  segmentSelectedPurple: 'rgba(168, 85, 247, 0.2)',
  segmentBorderPurple: '#A855F7',
  maintenanceSurface: 'rgba(28, 25, 23, 0.92)',
  maintenanceSectionLabel: '#CBD5E1',
} as const;

/** Bordas temáticas dos painéis de manutenção (carrossel) — padrão vigilance. */
export const UI_MAINTENANCE_PANEL_BORDERS = {
  default: 'rgba(52, 211, 153, 0.35)',
  sala: 'rgba(52, 211, 153, 0.35)',
  gantt: 'rgba(52, 211, 153, 0.35)',
  quorum: 'rgba(52, 211, 153, 0.35)',
  scaleTypes: 'rgba(52, 211, 153, 0.35)',
  scaleVolunteers: 'rgba(52, 211, 153, 0.35)',
  scales: 'rgba(52, 211, 153, 0.35)',
  pastoral: 'rgba(52, 211, 153, 0.35)',
  profile: 'rgba(52, 211, 153, 0.35)',
  financials: 'rgba(52, 211, 153, 0.35)',
  accessControl: 'rgba(52, 211, 153, 0.35)',
  menu: 'rgba(52, 211, 153, 0.35)',
} as const;

export const UI_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const UI_RADIUS = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const UI_PANEL_TYPO = {
  title: {
    fontSize: 17,
    fontWeight: '800' as const,
    lineHeight: 22,
    color: '#3A96DD',
  },
  titleMuted: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#3A96DD',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: 'rgba(58, 150, 221, 0.82)',
  },
} as const;

export const UI_TYPO = {
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  maintenanceSectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  segment: {
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 18,
  },
  activeModule: {
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
    lineHeight: 16,
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
} as const;

export const UI_SEGMENT = {
  minHeight: 48,
  paddingHorizontal: 10,
  paddingVertical: 10,
} as const;

/** Padding e raio do card do dashboard conforme largura da tela. */
export const computeResponsiveCardInsets = (screenWidth = SCREEN_WIDTH) => {
  if (screenWidth < 360) {
    return { padding: 16, borderRadius: 20 };
  }

  if (screenWidth < 400) {
    return { padding: 24, borderRadius: 28 };
  }

  return { padding: 32, borderRadius: 32 };
};

/** Padding interno dos painéis de manutenção (derivado do card responsivo). */
export const computeMaintenancePanelInsets = (screenWidth = SCREEN_WIDTH) => {
  const card = computeResponsiveCardInsets(screenWidth);

  return {
    borderRadius: card.borderRadius,
    innerPadding: Math.max(6, Math.round(card.padding * 0.22)),
    menuPadding: Math.max(14, Math.round(card.padding * 0.4)),
    scrollPadding: Math.max(12, Math.round(card.padding * 0.5)),
    gap: Math.max(6, Math.round(card.padding * 0.2)),
  };
};

export type UiAccent = 'emerald' | 'amber';

export const UI_ACCENT_STYLES: Record<
  UiAccent,
  { moduleColor: string; navBg: string; navBorder: string; navText: string; exitBg: string; exitBorder: string; exitText: string }
> = {
  emerald: {
    moduleColor: UI_COLORS.textAccentEmerald,
    navBg: 'rgba(16, 185, 129, 0.16)',
    navBorder: '#10B981',
    navText: '#D1FAE5',
    exitBg: 'rgba(245, 158, 11, 0.22)',
    exitBorder: '#FBBF24',
    exitText: '#FBBF24',
  },
  amber: {
    moduleColor: UI_COLORS.textAccentAmber,
    navBg: 'rgba(251, 191, 36, 0.16)',
    navBorder: '#FBBF24',
    navText: '#FEF3C7',
    exitBg: 'rgba(245, 158, 11, 0.22)',
    exitBorder: '#FBBF24',
    exitText: '#FBBF24',
  },
};
