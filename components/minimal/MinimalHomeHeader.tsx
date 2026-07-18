import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Reservado para extensões futuras do chrome; saudação ficou no corpo da inbox. */
export function MinimalHomeHeader(_props: { userName: string }) {
  return <View style={styles.wrap} />;
}

const styles = StyleSheet.create({
  wrap: {
    height: 0,
  },
});
