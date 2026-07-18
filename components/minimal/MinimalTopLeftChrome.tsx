import { MinimalExpandedEventBar } from '@/components/minimal/MinimalExpandedEventBar';
import { MinimalTopChurchLogo } from '@/components/minimal/MinimalTopChurchLogo';
import { MinimalTopIdentityBar } from '@/components/minimal/MinimalTopIdentityBar';
import { useAppDrawer } from '@/context/AppDrawerContext';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_ICON, MINIMAL_TOP_CHROME_MIN_HEIGHT, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  title?: string;
  header?: React.ReactNode;
  showGreeting?: boolean;
};

/** Chrome fixo no topo: coluna esquerda (saudação/menu) + logo à direita, centrado na altura. */
export function MinimalTopLeftChrome({ title, header, showGreeting = false }: Props) {
  const { openDrawer } = useAppDrawer();
  const { expandedEventId } = useMinimalHome();

  const menuButton = (
    <Pressable
      accessibilityLabel="Abrir menu"
      accessibilityRole="button"
      onPress={openDrawer}
      className="mt-0.5 p-1"
    >
      <FontAwesome name="bars" size={MINIMAL_ICON.menu} color={MINIMAL_UI.icon} />
    </Pressable>
  );

  return (
    <View
      className="relative z-30 shrink-0 gap-1 border-b border-minimal-divider bg-minimal-bg px-3 pb-2 pt-2"
      style={{ minHeight: MINIMAL_TOP_CHROME_MIN_HEIGHT }}
    >
      <View className="z-[1] w-1/2 gap-1 self-start">
        <MinimalTopIdentityBar showGreeting={showGreeting} />

        <View className="w-full self-start">
          <MinimalExpandedEventBar menuButton={menuButton} />
        </View>

        {!expandedEventId && (header || title?.trim()) ? (
          <View className="w-full items-start self-start pl-1">
            {header ? header : title?.trim() ? (
              <Text className="text-left text-minimal-title text-minimal-text">{title}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View
        className="absolute bottom-0 right-3 top-0 z-[2] items-end justify-center"
        pointerEvents="box-none"
      >
        <MinimalTopChurchLogo />
      </View>
    </View>
  );
}
