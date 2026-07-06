import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  userName: string;
};

export function MinimalHomeHeader({ userName }: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../images/IBNORTE - LOGO MARCA 9.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <Text style={styles.church}>Igreja Batista Norte</Text>
      <Text style={styles.greeting}>Olá, {userName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    gap: 4,
  },
  logo: {
    width: MINIMAL_ICON.logo,
    height: MINIMAL_ICON.logo,
    tintColor: MINIMAL_UI.icon,
  },
  church: {
    ...MINIMAL_TYPO.churchName,
    textAlign: 'left',
  },
  greeting: {
    ...MINIMAL_TYPO.greeting,
    textAlign: 'left',
  },
});
