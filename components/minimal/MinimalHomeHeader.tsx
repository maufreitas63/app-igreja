import { MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  userName: string;
};

/** Saudação exibida abaixo do menu (logo fica à direita no chrome). */
export function MinimalHomeHeader({ userName }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>Olá, {userName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  greeting: {
    ...MINIMAL_TYPO.greeting,
    textAlign: 'left',
  },
});
