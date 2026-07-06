import { useAppDrawer } from '@/context/AppDrawerContext';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  title?: string;
  header?: React.ReactNode;
};

/** Menu fixo no topo esquerdo; logo fixo no topo direito. */
export function MinimalTopLeftChrome({ title, header }: Props) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAppDrawer();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityLabel="Abrir menu"
          accessibilityRole="button"
          onPress={openDrawer}
          style={styles.menuButton}
        >
          <FontAwesome name="bars" size={MINIMAL_ICON.menu} color={MINIMAL_UI.icon} />
        </Pressable>

        <View style={styles.logoWrap}>
          <Image
            source={require('../../images/IBNORTE - LOGO MARCA 9.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
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
    justifyContent: 'space-between',
    width: '100%',
  },
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  logoWrap: {
    width: MINIMAL_ICON.logo,
    height: MINIMAL_ICON.logo,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  logo: {
    width: MINIMAL_ICON.logo,
    height: MINIMAL_ICON.logo,
    tintColor: MINIMAL_UI.icon,
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
