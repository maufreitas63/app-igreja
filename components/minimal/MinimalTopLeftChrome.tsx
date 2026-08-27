import { MinimalExpandedEventBar } from '@/components/minimal/MinimalExpandedEventBar';
import { MinimalTopChurchLogo } from '@/components/minimal/MinimalTopChurchLogo';
import { MinimalTopIdentityBar } from '@/components/minimal/MinimalTopIdentityBar';
import { useAppDrawer } from '@/context/AppDrawerContext';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_ICON, MINIMAL_SCREEN_PADDING_LEFT, MINIMAL_SCREEN_PADDING_RIGHT, MINIMAL_TOP_CHROME_MIN_HEIGHT, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  title?: string;
  header?: React.ReactNode;
  showGreeting?: boolean;
};

/**
 * Chrome fixo no topo: linha flex (saudação+menu | logo).
 * Sem overlay absoluto — o nome não fica espremido sob o logo.
 */
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
      <View style={styles.mainRow}>
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

        <View style={styles.logoColumn} pointerEvents="none">
          <MinimalTopChurchLogo />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
    zIndex: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    minHeight: MINIMAL_TOP_CHROME_MIN_HEIGHT,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  leftStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  logoColumn: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  menuChrome: {
    width: '100%',
    alignSelf: 'stretch',
  },
  leftColumn: {
    alignItems: 'flex-start',
    paddingLeft: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    textAlign: 'left',
  },
});
