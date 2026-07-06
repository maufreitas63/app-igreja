import { MINIMAL_EXIT_BAR_HEIGHT, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { confirmExitApplication } from '@/lib/userSession';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MinimalExitBar() {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      accessibilityLabel="Sair do Aplicativo"
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={() => {
        void confirmExitApplication();
      }}
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 8) },
        Platform.OS === 'web' ? styles.barWeb : null,
      ]}
    >
      <Text style={styles.label}>Sair do Aplicativo</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: MINIMAL_EXIT_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: MINIMAL_UI.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    zIndex: 100,
    elevation: 12,
  },
  barWeb: {
    cursor: 'pointer',
  },
  label: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '700',
    color: MINIMAL_UI.icon,
  },
});
