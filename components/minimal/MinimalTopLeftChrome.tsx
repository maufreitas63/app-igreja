import { MinimalExpandedEventBar } from '@/components/minimal/MinimalExpandedEventBar';
import { MinimalTopIdentityBar } from '@/components/minimal/MinimalTopIdentityBar';
import { useAppDrawer } from '@/context/AppDrawerContext';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  title?: string;
  header?: React.ReactNode;
};

/** Menu fixo no topo esquerdo; evento expandido na mesma linha (50/50). */
export function MinimalTopLeftChrome({ title, header }: Props) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAppDrawer();
  const { expandedEventId } = useMinimalHome();

  const menuButton = (
    <Pressable
      accessibilityLabel="Abrir menu"
      accessibilityRole="button"
      onPress={openDrawer}
      style={styles.menuButton}
    >
      <FontAwesome name="bars" size={MINIMAL_ICON.menu} color={MINIMAL_UI.icon} />
    </Pressable>
  );

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <MinimalTopIdentityBar />

      <View style={styles.menuChrome}>
        <MinimalExpandedEventBar menuButton={menuButton} />
      </View>

      {!expandedEventId && (header || title) ? (
        <View style={styles.leftColumn}>
          {header ? header : title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      ) : null}
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
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  menuChrome: {
    width: '100%',
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
