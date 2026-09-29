import {
  MINIMAL_SCREEN_PADDING_LEFT,
  MINIMAL_SCREEN_PADDING_RIGHT,
  MINIMAL_UI,
} from '@/lib/minimalUiTheme';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const CLOSE_BUTTON_FILL = MINIMAL_UI.accent;
const CLOSE_BUTTON_BORDER = MINIMAL_UI.blueDark;

/** Altura do botão canónico (Agenda da Família). */
export const CLOSE_FOOTER_BUTTON_HEIGHT = 51;
/** Espaço vertical entre botões empilhados no dock. */
export const CLOSE_FOOTER_BUTTON_GAP = 8;
/** paddingTop 8 + paddingBottom 12 + botão 51 + border 1 — reserva no fluxo da tela. */
export const CLOSE_FOOTER_DOCK_HEIGHT = 8 + 12 + CLOSE_FOOTER_BUTTON_HEIGHT + 1;

export type CloseButtonVariant = 'solid' | 'outline';

export type CloseButtonProps = {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
  /** `solid` = azul com texto branco (Fechar); `outline` = branco com texto azul. */
  variant?: CloseButtonVariant;
};

type CloseFooterBarProps = {
  onPress: () => void;
  variant?: 'minimal' | 'dark';
  contentInsetBottom?: number;
  label?: string;
  accessibilityLabel?: string;
  /** Ignorado: o dock usa sempre o padding das telas, relativo à viewport. */
  includeScreenPadding?: boolean;
  /**
   * Botão acima do «Fechar», mesma altura/largura — tipicamente outline
   * (ex.: Espaço Infantil | Check-in QR na Agenda da Família).
   */
  secondaryAction?: {
    label: string;
    onPress: () => void;
    accessibilityLabel?: string;
    variant?: CloseButtonVariant;
  } | null;
};

function buildWebButtonStyle(variant: CloseButtonVariant): React.CSSProperties {
  const isOutline = variant === 'outline';
  return {
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
    backgroundColor: isOutline ? '#FFFFFF' : CLOSE_BUTTON_FILL,
    color: isOutline ? CLOSE_BUTTON_BORDER : '#FFFFFF',
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
}

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
  buttonOutline: {
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonTextOutline: {
    color: CLOSE_BUTTON_BORDER,
  },
});

/** Botão «Fechar» canónico — azul, 51px, borda 2px, `<button>` na web. */
export function CloseButton({
  onPress,
  label = 'Fechar',
  accessibilityLabel,
  variant = 'solid',
}: CloseButtonProps) {
  const resolvedLabel = accessibilityLabel ?? label;
  const isOutline = variant === 'outline';

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
        style: buildWebButtonStyle(variant),
      },
      label
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[closeButtonStyles.button, isOutline ? closeButtonStyles.buttonOutline : null]}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
    >
      <Text
        style={[
          closeButtonStyles.buttonText,
          isOutline ? closeButtonStyles.buttonTextOutline : null,
        ]}
      >
        {label}
      </Text>
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
  secondaryAction = null,
}: CloseFooterBarProps) {
  const extraBottom = Math.max(0, contentInsetBottom);
  const stackedExtra = secondaryAction
    ? CLOSE_FOOTER_BUTTON_HEIGHT + CLOSE_FOOTER_BUTTON_GAP
    : 0;
  const reserveHeight = CLOSE_FOOTER_DOCK_HEIGHT + stackedExtra + extraBottom;

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
          {secondaryAction ? (
            <View style={styles.secondarySlot}>
              <CloseButton
                onPress={secondaryAction.onPress}
                label={secondaryAction.label}
                accessibilityLabel={
                  secondaryAction.accessibilityLabel ?? secondaryAction.label
                }
                variant={secondaryAction.variant ?? 'outline'}
              />
            </View>
          ) : null}
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
    borderTopColor: MINIMAL_UI.divider,
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
  secondarySlot: {
    width: '100%',
    marginBottom: CLOSE_FOOTER_BUTTON_GAP,
  },
});
