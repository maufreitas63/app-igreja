// app/_layout.tsx
import { Buffer } from 'buffer';

if (!global.Buffer) {
  global.Buffer = Buffer;
}

import { AppShell } from '@/components/AppShell';
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function RootLayout() {
  const [iconFontsLoaded] = useFonts({
    ...FontAwesome.font,
    ...FontAwesome5.font,
    ...MaterialIcons.font,
  });

  if (!iconFontsLoaded) {
    return (
      <View style={styles.fontLoader}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

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
  fontLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
