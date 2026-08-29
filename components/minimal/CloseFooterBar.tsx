import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export type CloseButtonProps = {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
};

type CloseFooterBarProps = {
  onPress: () => void;
  variant?: 'minimal' | 'dark';
  contentInsetBottom?: number;
};

const closeButtonStyles = StyleSheet.create({
  button: {
    minHeight: 51,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1B4F8A',
    backgroundColor: '#3A96DD',
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
  return (
    <Pressable
      onPress={onPress}
      style={closeButtonStyles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={closeButtonStyles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** Rodapé fixo com o botão «Fechar» canônico. */
export function CloseFooterBar({
  onPress,
  variant = 'minimal',
  contentInsetBottom = 0,
}: CloseFooterBarProps) {
  return (
    <View
      style={[
        styles.footerBar,
        variant === 'dark' ? styles.footerBarDark : styles.footerBarMinimal,
        contentInsetBottom > 0 ? { paddingBottom: 12 + contentInsetBottom } : null,
      ]}
    >
      <CloseButton onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
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
