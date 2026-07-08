import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';

/** Tema vigilance para painéis do maintenance-dashboard e cards Maintenance*. */
export const MAINTENANCE_VIGILANCE_UI = {
  accent: VIGILANCE_SCALES_UI.accent,
  icon: '#1B4F8A',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  surfaceHighlight: '#F0F9FF',
  border: 'rgba(52, 211, 153, 0.35)',
  borderAccent: VIGILANCE_SCALES_UI.accent,
  textMuted: 'rgba(58, 150, 221, 0.82)',
  submitBg: '#3A96DD',
  submitText: '#FFFFFF',
} as const;

export const MAINTENANCE_VIGILANCE_ACCENT = MAINTENANCE_VIGILANCE_UI.accent;
