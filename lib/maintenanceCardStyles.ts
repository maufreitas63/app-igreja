import { UI_PANEL_TYPO, UI_RADIUS, UI_SPACING } from '@/lib/uiTokens';
import type { ScrollViewProps } from 'react-native';
import { StyleSheet } from 'react-native';

/** Rolagem interna dos painéis sem exibir barra de rolagem. */
export const MAINTENANCE_SCROLL_PROPS = {
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} satisfies Pick<ScrollViewProps, 'showsVerticalScrollIndicator' | 'showsHorizontalScrollIndicator'>;

/** Estilos compartilhados dos painéis internos do carrossel de manutenção. */
export const maintenancePanelStyles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: UI_SPACING.sm,
  },
  panelCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: UI_SPACING.md,
  },
  panelTitle: {
    fontSize: UI_PANEL_TYPO.title.fontSize,
    fontWeight: UI_PANEL_TYPO.title.fontWeight,
    lineHeight: UI_PANEL_TYPO.title.lineHeight,
    color: UI_PANEL_TYPO.title.color,
  },
  panelTitleMuted: {
    fontSize: UI_PANEL_TYPO.titleMuted.fontSize,
    fontWeight: UI_PANEL_TYPO.titleMuted.fontWeight,
    color: UI_PANEL_TYPO.titleMuted.color,
  },
  panelSubtitle: {
    fontSize: UI_PANEL_TYPO.subtitle.fontSize,
    fontWeight: UI_PANEL_TYPO.subtitle.fontWeight,
    lineHeight: UI_PANEL_TYPO.subtitle.lineHeight,
    color: UI_PANEL_TYPO.subtitle.color,
  },
  panelHint: {
    color: UI_PANEL_TYPO.subtitle.color,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: UI_SPACING.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: UI_RADIUS.sm,
    paddingHorizontal: UI_SPACING.md,
    paddingVertical: UI_SPACING.sm,
    color: '#F8FAFC',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
});

export const computeMaintenanceContentHeight = (panelHeight: number) =>
  Math.max(280, panelHeight - UI_SPACING.md);
