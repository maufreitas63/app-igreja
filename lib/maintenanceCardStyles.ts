import { MAINTENANCE_VIGILANCE_UI } from '@/lib/maintenanceVigilanceTheme';
import { UI_RADIUS, UI_SPACING } from '@/lib/uiTokens';
import type { ScrollViewProps } from 'react-native';
import { StyleSheet } from 'react-native';

/** Rolagem interna dos painéis sem exibir barra de rolagem. */
export const MAINTENANCE_SCROLL_PROPS = {
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} satisfies Pick<ScrollViewProps, 'showsVerticalScrollIndicator' | 'showsHorizontalScrollIndicator'>;

/** Estilos compartilhados dos painéis internos do carrossel de manutenção (tema vigilance). */
export const maintenancePanelStyles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: UI_SPACING.sm,
    backgroundColor: MAINTENANCE_VIGILANCE_UI.surface,
  },
  panelCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: UI_SPACING.md,
    backgroundColor: MAINTENANCE_VIGILANCE_UI.surface,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    color: MAINTENANCE_VIGILANCE_UI.accent,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  panelTitleMuted: {
    fontSize: 16,
    fontWeight: '800',
    color: MAINTENANCE_VIGILANCE_UI.accent,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  panelSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: MAINTENANCE_VIGILANCE_UI.textMuted,
  },
  /** Reserva a altura de uma linha de `panelSubtitle` sem exibir texto. */
  panelSubtitleSpacer: {
    height: 16,
  },
  panelHint: {
    color: MAINTENANCE_VIGILANCE_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: UI_SPACING.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: MAINTENANCE_VIGILANCE_UI.border,
    borderRadius: UI_RADIUS.sm,
    paddingHorizontal: UI_SPACING.md,
    paddingVertical: UI_SPACING.sm,
    color: MAINTENANCE_VIGILANCE_UI.accent,
    backgroundColor: MAINTENANCE_VIGILANCE_UI.surface,
  },
});

export const computeMaintenanceContentHeight = (panelHeight: number) =>
  Math.max(280, panelHeight - UI_SPACING.md);
