import { MinimalExpandedEventBar } from '@/components/minimal/MinimalExpandedEventBar';
import { useAppDrawer } from '@/context/AppDrawerContext';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  title?: string;
  header?: React.ReactNode;
};

/** Menu fixo no topo esquerdo + faixa do evento expandido acima. */
export function MinimalTopLeftChrome({ title, header }: Props) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAppDrawer();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <MinimalExpandedEventBar />

      <View style={styles.topRow}>
        <Pressable
          accessibilityLabel="Abrir menu"
          accessibilityRole="button"
          onPress={openDrawer}
          style={styles.menuButton}
        >
          <FontAwesome name="bars" size={MINIMAL_ICON.menu} color={MINIMAL_UI.icon} />
        </Pressable>
      </View>

      <View style={styles.leftColumn}>
        {header ? (
          header
        ) : title ? (
          <Text style={styles.title}>{title}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  leftColumn: {
    alignItems: 'flex-start',
    paddingLeft: 4,
    maxWidth: '36%',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    textAlign: 'left',
  },
});
