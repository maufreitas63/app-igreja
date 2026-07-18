import { MINIMAL_ICON, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
      className="h-12 w-full max-w-full min-w-0 shrink-0 flex-row items-center bg-minimal-bg px-1 cursor-pointer active:bg-minimal-hover"
      style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: MINIMAL_UI.divider }}
    >
      <View className="h-12 w-10 items-center justify-center">
        {variant === 'toEventos' ? (
          <MaterialIcons name="chevron-left" size={MINIMAL_ICON.chevron} color={MINIMAL_UI.blueDark} />
        ) : null}
      </View>

      <Text
        className="min-w-0 flex-1 py-0 text-center text-lg font-bold text-minimal-blue-dark"
        numberOfLines={1}
      >
        {label}
      </Text>

      <View className="h-12 w-10 items-center justify-center">
        {variant === 'toAvisos' ? (
          <MaterialIcons name="chevron-right" size={MINIMAL_ICON.chevron} color={MINIMAL_UI.blueDark} />
        ) : null}
      </View>
    </Pressable>
  );
}

export const HOME_INBOX_PAGER_NAV_HEIGHT = 48;
