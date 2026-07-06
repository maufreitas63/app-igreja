import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 6,
  },
  logo: {
    width: 48,
    height: 48,
    tintColor: MINIMAL_UI.icon,
  },
  church: {
    ...MINIMAL_TYPO.churchName,
    textAlign: 'center',
  },
  greeting: {
    ...MINIMAL_TYPO.greeting,
    textAlign: 'center',
  },
});
