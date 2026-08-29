import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import {
  MINIMAL_SCREEN_PADDING_LEFT,
  MINIMAL_SCREEN_PADDING_RIGHT,
} from '@/lib/minimalUiTheme';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const CLOSE_BUTTON_FILL = '#3A96DD';
const CLOSE_BUTTON_BORDER = '#1B4F8A';

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
  /** Quando o pai não aplica o padding lateral das telas minimalistas. */
  includeScreenPadding?: boolean;
};

const WEB_BUTTON_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 51,
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
    minHeight: 51,
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

/** Botão «Fechar» canônico — azul, 51px, borda 2px, `<button>` na web. */
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

/** Rodapé fixo com o botão «Fechar» canônico (largura, inset e posição iguais em toda a app). */
export function CloseFooterBar({
  onPress,
  variant = 'minimal',
  contentInsetBottom = 0,
  label,
  accessibilityLabel,
  includeScreenPadding = false,
}: CloseFooterBarProps) {
  return (
    <View style={includeScreenPadding ? styles.screenPad : styles.stretch}>
      <View
        style={[
          styles.footerBar,
          variant === 'dark' ? styles.footerBarDark : styles.footerBarMinimal,
          contentInsetBottom > 0 ? { paddingBottom: 12 + contentInsetBottom } : null,
        ]}
      >
        <CloseButton
          onPress={onPress}
          label={label}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  screenPad: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
  },
  footerBar: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    width: '100%',
  },
  footerBarMinimal: {
    borderTopColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: '#FFFFFF',
  },
  footerBarDark: {
    borderTopColor: '#334155',
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
  },
});
