import { StyleSheet } from 'react-native';

/** Preserva literais (`'center'`, etc.) — `StyleSheet.create` no RN 0.81 alarga a união. */
export function createStyles<const T>(styles: T): T {
  return StyleSheet.create(styles as StyleSheet.NamedStyles<Record<string, never>>) as T;
}
