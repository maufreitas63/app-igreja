import { MINIMAL_ICON, MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type HomeInboxPagerNavProps = {
  /** `toAvisos`: título Avisos + chevron à direita. `toEventos`: chevron à esquerda + Eventos. */
  variant: 'toAvisos' | 'toEventos';
  onPress: () => void;
};

/**
 * Faixa de navegação da home: Eventos ↔ Avisos (Minimal UI).
 * Espelha o layout das figuras — título centralizado e chevron nas extremidades.
 */
export function HomeInboxPagerNav({ variant, onPress }: HomeInboxPagerNavProps) {
  const label = variant === 'toAvisos' ? 'Avisos' : 'Eventos';
  const accessibilityLabel =
    variant === 'toAvisos' ? 'Ir para avisos' : 'Voltar para próximos eventos';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.sideSlot}>
        {variant === 'toEventos' ? (
          <MaterialIcons name="chevron-left" size={MINIMAL_ICON.chevron} color={MINIMAL_UI.blueDark} />
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {label}
      </Text>

      <View style={[styles.sideSlot, styles.sideSlotEnd]}>
        {variant === 'toAvisos' ? (
          <MaterialIcons name="chevron-right" size={MINIMAL_ICON.chevron} color={MINIMAL_UI.blueDark} />
        ) : null}
      </View>
    </Pressable>
  );
}

export const HOME_INBOX_PAGER_NAV_HEIGHT = 48;

const styles = StyleSheet.create({
  row: {
    height: HOME_INBOX_PAGER_NAV_HEIGHT,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  rowPressed: {
    backgroundColor: MINIMAL_UI.divider,
  },
  sideSlot: {
    width: 40,
    height: HOME_INBOX_PAGER_NAV_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlotEnd: {
    alignItems: 'center',
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 18,
    color: MINIMAL_UI.blueDark,
    // Herda o fundo da faixa (rowHover); MINIMAL_SECTION_TITLE traz branco.
    backgroundColor: 'transparent',
  },
});
