import {
  VIGILANCE_LIGHT_CARD_THEME,
  VIGILANCE_SCALES_UI,
  type DashboardCardTheme,
} from '@/lib/dashboardCardThemes';
import { computeResponsiveCardInsets } from '@/lib/uiTokens';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/** Tema visual canônico — referência: dashboard_card_vigilance_scales. */
export const DASHBOARD_CARD_REFERENCE_THEME: DashboardCardTheme = VIGILANCE_LIGHT_CARD_THEME;

const CARD_INSETS = computeResponsiveCardInsets(390);

/** Shell compartilhado de todos os cards de dashboard (fundo, borda, sombra, raio). */
export const DASHBOARD_CARD_SHELL: ViewStyle = {
  backgroundColor: DASHBOARD_CARD_REFERENCE_THEME.backgroundColor,
  borderWidth: 1,
  borderColor: DASHBOARD_CARD_REFERENCE_THEME.borderColor,
  borderRadius: CARD_INSETS.borderRadius,
  elevation: 5,
  shadowColor: DASHBOARD_CARD_REFERENCE_THEME.shadowColor,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.3,
  shadowRadius: 15,
};

/** Layout interno padrão do card Escalas (padding e gap). */
export const DASHBOARD_CARD_BODY_LAYOUT: ViewStyle = {
  paddingHorizontal: 20,
  paddingBottom: 20,
  gap: 12,
};

/** Faixa superior / badge alinhada ao card Escalas. */
export const DASHBOARD_CARD_HEADER_SURFACE: ViewStyle = {
  backgroundColor: VIGILANCE_SCALES_UI.headerSurface,
  borderWidth: 1,
  borderColor: VIGILANCE_SCALES_UI.border,
  borderRadius: 18,
};

/** Painel de manutenção — mesma casca visual dos cards do dashboard. */
export const MAINTENANCE_DASHBOARD_PANEL_SHELL: ViewStyle = {
  ...DASHBOARD_CARD_SHELL,
  overflow: 'hidden',
};

export const DASHBOARD_CARD_TYPO = {
  panelTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    lineHeight: 22,
    color: VIGILANCE_SCALES_UI.accent,
    textAlign: 'center' as const,
  } satisfies TextStyle,
  cardTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: VIGILANCE_SCALES_UI.accent,
    textAlign: 'center' as const,
  } satisfies TextStyle,
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: VIGILANCE_SCALES_UI.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  } satisfies TextStyle,
  body: {
    color: VIGILANCE_SCALES_UI.accent,
  } satisfies TextStyle,
  bodyMuted: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 0.88,
  } satisfies TextStyle,
  summary: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  } satisfies TextStyle,
};

export const DASHBOARD_CARD_INTERACTIVE_ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: VIGILANCE_SCALES_UI.borderMuted,
  backgroundColor: VIGILANCE_SCALES_UI.surface,
};

export const DASHBOARD_CARD_INTERACTIVE_ROW_SELECTED: ViewStyle = {
  borderColor: VIGILANCE_SCALES_UI.border,
  backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
};

/** Estilos reutilizáveis via StyleSheet.create nos dashboards. */
export const dashboardCardStyles = StyleSheet.create({
  shell: DASHBOARD_CARD_SHELL,
  bodyLayout: DASHBOARD_CARD_BODY_LAYOUT,
  headerSurface: DASHBOARD_CARD_HEADER_SURFACE,
  panelTitle: DASHBOARD_CARD_TYPO.panelTitle,
  cardTitle: DASHBOARD_CARD_TYPO.cardTitle,
  sectionLabel: DASHBOARD_CARD_TYPO.sectionLabel,
  body: DASHBOARD_CARD_TYPO.body,
  bodyMuted: DASHBOARD_CARD_TYPO.bodyMuted,
  summary: DASHBOARD_CARD_TYPO.summary,
  interactiveRow: DASHBOARD_CARD_INTERACTIVE_ROW,
  interactiveRowSelected: DASHBOARD_CARD_INTERACTIVE_ROW_SELECTED,
});
