import { MinimalExpandedEventBar } from '@/components/minimal/MinimalExpandedEventBar';
import { MinimalTopChurchLogo } from '@/components/minimal/MinimalTopChurchLogo';
import { MinimalTopIdentityBar } from '@/components/minimal/MinimalTopIdentityBar';
import { useAppDrawer } from '@/context/AppDrawerContext';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_ICON, MINIMAL_TOP_CHROME_MIN_HEIGHT, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
      style={styles.menuButton}
    >
      <FontAwesome name="bars" size={MINIMAL_ICON.menu} color={MINIMAL_UI.icon} />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.leftStack}>
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

      <View style={styles.logoOverlay} pointerEvents="box-none">
        <MinimalTopChurchLogo />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
    gap: 4,
    zIndex: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    minHeight: MINIMAL_TOP_CHROME_MIN_HEIGHT,
  },
  leftStack: {
    width: '50%',
    alignSelf: 'flex-start',
    gap: 4,
    zIndex: 1,
  },
  logoOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  menuChrome: {
    width: '100%',
    alignSelf: 'flex-start',
  },
  leftColumn: {
    alignItems: 'flex-start',
    paddingLeft: 4,
    width: '100%',
    alignSelf: 'flex-start',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    textAlign: 'left',
  },
});
