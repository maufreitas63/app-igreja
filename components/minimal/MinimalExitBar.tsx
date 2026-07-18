import { MINIMAL_EXIT_BAR_HEIGHT, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getExitSessionUi } from '@/lib/sessionExitUi';
import { confirmExitApplication } from '@/lib/userSession';
import { cn } from '@/lib/utils';
import React, { useMemo } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
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
      className={cn(
        'shrink-0 items-center justify-center border-t border-minimal-divider bg-minimal-bg px-4 pt-3',
        isDrawer ? 'w-full self-stretch' : 'absolute bottom-0 left-0 right-0 z-[100]',
        Platform.OS === 'web' && 'cursor-pointer'
      )}
      style={{
        minHeight: MINIMAL_EXIT_BAR_HEIGHT,
        paddingBottom: Math.max(insets.bottom, 8),
        ...(Platform.OS !== 'web' && !isDrawer ? { elevation: 12 } : null),
      }}
    >
      <Text className="text-minimal-menu font-bold" style={{ color: MINIMAL_UI.icon }}>
        {exitUi.button}
      </Text>
    </TouchableOpacity>
  );
}
