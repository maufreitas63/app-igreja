import { useAppDrawer } from '@/context/AppDrawerContext';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RegistrationCounterLabel } from './RegistrationCounterLabel';

type Props = {
  title?: string;
  header?: React.ReactNode;
};

/** Menu e identidade fixos no topo esquerdo (css-146c3p1). */
export function MinimalTopLeftChrome({ title, header }: Props) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAppDrawer();
  const { expandedEvent } = useMinimalHome();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="Abrir menu"
          accessibilityRole="button"
          onPress={openDrawer}
          style={styles.menuButton}
        >
          <FontAwesome name="bars" size={MINIMAL_ICON.menu} color={MINIMAL_UI.icon} />
        </Pressable>
        <View style={styles.textColumn}>
          {header ? (
            header
          ) : title ? (
            <Text style={styles.title}>{title}</Text>
          ) : null}
        </View>
      </View>
      {expandedEvent ? (
        <RegistrationCounterLabel
          registeredCount={expandedEvent.registeredCount}
          maxCapacity={expandedEvent.max_capacity}
        />
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
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    textAlign: 'left',
  },
});
