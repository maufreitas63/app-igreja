/** Paletas visuais dos cards do carrossel do dashboard. */
export type DashboardCardTheme = {
  backgroundColor: string;
  borderColor: string;
  shadowColor: string;
  accent: string;
  accentMuted: string;
};

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
  members_list: {
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderColor: '#FB7185',
    shadowColor: '#E11D48',
    accent: '#FECDD3',
    accentMuted: '#FDA4AF',
  },
  birthdays: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderColor: '#38BDF8',
    shadowColor: '#0284C7',
    accent: '#BAE6FD',
    accentMuted: '#7DD3FC',
  },
  financial: {
    backgroundColor: 'rgba(5, 150, 105, 0.22)',
    borderColor: '#34D399',
    shadowColor: '#059669',
    accent: '#A7F3D0',
    accentMuted: '#6EE7B7',
  },
  vigilance_scales: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: '#FB923C',
    shadowColor: '#EA580C',
    accent: '#FED7AA',
    accentMuted: '#FDBA74',
  },
  scale_roster: {
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    borderColor: '#A78BFA',
    shadowColor: '#7C3AED',
    accent: '#DDD6FE',
    accentMuted: '#C4B5FD',
  },
  parking_vehicle_v2: {
    backgroundColor: 'rgba(180, 83, 9, 0.22)',
    borderColor: '#FCD34D',
    shadowColor: '#B45309',
    accent: '#FEF3C7',
    accentMuted: '#FDE68A',
  },
  grouped_manage: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#60A5FA',
    shadowColor: '#2563EB',
    accent: '#BFDBFE',
    accentMuted: '#93C5FD',
  },
} as const satisfies Record<string, DashboardCardTheme>;
