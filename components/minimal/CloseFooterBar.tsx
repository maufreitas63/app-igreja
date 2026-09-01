import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import {
  MINIMAL_SCREEN_PADDING_LEFT,
  MINIMAL_SCREEN_PADDING_RIGHT,
} from '@/lib/minimalUiTheme';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const CLOSE_BUTTON_FILL = '#3A96DD';
const CLOSE_BUTTON_BORDER = '#1B4F8A';

/** Altura do botão canónico (Agenda da Família). */
export const CLOSE_FOOTER_BUTTON_HEIGHT = 51;
/** paddingTop 8 + paddingBottom 12 + botão 51 + border 1 — reserva no fluxo da tela. */
export const CLOSE_FOOTER_DOCK_HEIGHT = 8 + 12 + CLOSE_FOOTER_BUTTON_HEIGHT + 1;

export type CloseButtonProps = {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
};

type CloseFooterBarProps = {
  onPress: () => void;
  variant?: 'minimal' | 'dark';
  contentInsetBottom?: number;
  label?: string;
  accessibilityLabel?: string;
  /** Ignorado: o dock usa sempre o padding das telas, relativo à viewport. */
  includeScreenPadding?: boolean;
};

const WEB_BUTTON_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: CLOSE_FOOTER_BUTTON_HEIGHT,
  margin: 0,
  paddingBlock: 14,
  paddingInline: 16,
  borderRadius: 16,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: CLOSE_BUTTON_BORDER,
  backgroundColor: CLOSE_BUTTON_FILL,
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: 800,
  fontFamily: 'inherit',
  lineHeight: '20px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  appearance: 'none',
  WebkitAppearance: 'none',
};

const closeButtonStyles = StyleSheet.create({
  button: {
    minHeight: CLOSE_FOOTER_BUTTON_HEIGHT,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: CLOSE_BUTTON_BORDER,
    backgroundColor: CLOSE_BUTTON_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

/** Botão «Fechar» canónico — azul, 51px, borda 2px, `<button>` na web. */
export function CloseButton({
  onPress,
  label = 'Fechar',
  accessibilityLabel,
}: CloseButtonProps) {
  const resolvedLabel = accessibilityLabel ?? label;

  if (Platform.OS === 'web') {
    return React.createElement(
      'button',
      {
        type: 'button',
        'aria-label': resolvedLabel,
        onClick: (event: { preventDefault: () => void }) => {
          event.preventDefault();
          onPress();
        },
        style: WEB_BUTTON_STYLE,
      },
      label
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={closeButtonStyles.button}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
    >
      <Text style={closeButtonStyles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Rodapé «Fechar» ancorado na margem inferior da tela — mesma altura da Agenda da Família.
 * Na web usa `position: fixed` na viewport; o espaço no fluxo evita que o conteúdo fique por baixo.
 */
export function CloseFooterBar({
  onPress,
  variant = 'minimal',
  contentInsetBottom = 0,
  label,
  accessibilityLabel,
}: CloseFooterBarProps) {
  const extraBottom = Math.max(0, contentInsetBottom);
  const reserveHeight = CLOSE_FOOTER_DOCK_HEIGHT + extraBottom;

  return (
    <>
      <View
        style={[styles.reserve, { height: reserveHeight }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={[
          styles.dock,
          variant === 'dark' ? styles.dockDark : styles.dockMinimal,
          extraBottom > 0 ? { paddingBottom: 12 + extraBottom } : null,
        ]}
      >
        <View style={styles.innerPad}>
          <CloseButton
            onPress={onPress}
            label={label}
            accessibilityLabel={accessibilityLabel}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  reserve: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
    marginTop: 'auto',
    pointerEvents: 'none',
  },
  dock: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    width: '100%',
    maxWidth: '100%',
    paddingTop: 8,
    paddingBottom: 12,
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
    borderTopWidth: 1,
    ...(Platform.OS === 'web'
      ? ({ boxSizing: 'border-box' } as object)
      : null),
  },
  dockMinimal: {
    borderTopColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: '#FFFFFF',
  },
  dockDark: {
    borderTopColor: '#334155',
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
  },
  innerPad: {
    width: '100%',
    paddingHorizontal: 16,
  },
});
