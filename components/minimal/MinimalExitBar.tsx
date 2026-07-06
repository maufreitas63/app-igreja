import { MINIMAL_EXIT_BAR_HEIGHT, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { exitApplication } from '@/lib/userSession';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MinimalExitBar() {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityLabel="Sair do Aplicativo"
      accessibilityRole="button"
      onPress={() => exitApplication()}
      style={({ pressed }) => [
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 8) },
        pressed && styles.barPressed,
      ]}
    >
      <Text style={styles.label}>Sair do Aplicativo</Text>
    </Pressable>
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
    zIndex: 25,
  },
  barPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  label: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '700',
    color: MINIMAL_UI.icon,
  },
});
