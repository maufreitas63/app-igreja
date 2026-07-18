import { MINIMAL_EXIT_BAR_HEIGHT, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getExitSessionUi } from '@/lib/sessionExitUi';
import { confirmExitApplication } from '@/lib/userSession';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Barra fixa no rodapé do menu lateral (padrão). */
  variant?: 'drawer' | 'screen';
};

export function MinimalExitBar({ variant = 'drawer' }: Props) {
  const insets = useSafeAreaInsets();
  const exitUi = useMemo(() => getExitSessionUi(), []);
  const isDrawer = variant === 'drawer';

  return (
    <TouchableOpacity
      accessibilityHint={exitUi.accessibilityHint}
      accessibilityLabel={exitUi.accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={() => {
        void confirmExitApplication();
      }}
      style={[
        styles.bar,
        isDrawer ? styles.barDrawer : styles.barScreen,
        { paddingBottom: Math.max(insets.bottom, 8) },
        Platform.OS === 'web' ? styles.barWeb : null,
      ]}
    >
      <Text style={styles.label}>{exitUi.button}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: MINIMAL_EXIT_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: MINIMAL_UI.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    flexShrink: 0,
  },
  barDrawer: {
    width: '100%',
    alignSelf: 'stretch',
  },
  barScreen: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
