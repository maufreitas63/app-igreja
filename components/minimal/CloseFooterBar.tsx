import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type CloseFooterBarProps = {
  onPress: () => void;
  variant?: 'minimal' | 'dark';
};

/** Rodapé fixo com botão «Fechar» — mesmo markup/estilo em Pastoral, Ofertas e Agenda. */
export function CloseFooterBar({ onPress, variant = 'minimal' }: CloseFooterBarProps) {
  return (
    <View style={[styles.footerBar, variant === 'dark' ? styles.footerBarDark : styles.footerBarMinimal]}>
      <Pressable
        onPress={onPress}
        style={styles.closeFooterButton}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      >
        <Text style={styles.closeFooterButtonText}>Fechar</Text>
      </Pressable>
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
  closeFooterButton: {
    minHeight: 51,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1B4F8A',
    backgroundColor: '#3A96DD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
