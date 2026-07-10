import { MinimalExpandedEventBar } from '@/components/minimal/MinimalExpandedEventBar';
import { MinimalTopIdentityBar } from '@/components/minimal/MinimalTopIdentityBar';
import { useAppDrawer } from '@/context/AppDrawerContext';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  title?: string;
  header?: React.ReactNode;
  showGreeting?: boolean;
};

/** Chrome fixo no topo: identidade + menu; o conteúdo da tela fica sempre abaixo. */
export function MinimalTopLeftChrome({ title, header, showGreeting = false }: Props) {
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
    <View style={styles.wrap}>
      <MinimalTopIdentityBar showGreeting={showGreeting} />

      <View style={styles.menuChrome}>
        <MinimalExpandedEventBar menuButton={menuButton} />
      </View>

      {!expandedEventId && (header || title?.trim()) ? (
        <View style={styles.leftColumn}>
          {header ? header : title?.trim() ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
    gap: 4,
    zIndex: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  menuChrome: {
    width: '50%',
    alignSelf: 'flex-start',
  },
  leftColumn: {
    alignItems: 'flex-start',
    paddingLeft: 4,
    maxWidth: '50%',
    alignSelf: 'flex-start',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    textAlign: 'left',
  },
});
