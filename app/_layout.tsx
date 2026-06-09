// app/_layout.tsx
import { Buffer } from 'buffer';

if (!global.Buffer) {
  global.Buffer = Buffer;
}

import { AppShell } from '@/components/AppShell';
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost';
import Toast from 'react-native-toast-message';
import { StyleSheet, View } from 'react-native';

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <AppShell />
      <ConfirmDialogHost />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
