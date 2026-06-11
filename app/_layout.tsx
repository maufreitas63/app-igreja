// app/_layout.tsx
import { Buffer } from 'buffer';

if (!global.Buffer) {
  global.Buffer = Buffer;
}

import { AppShell } from '@/components/AppShell';
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost';
import { appToastConfig } from '@/components/ui/appToastConfig';
import { ICON_FONT_SOURCES } from '@/lib/iconFonts';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

export default function RootLayout() {
  const [iconFontsLoaded] = useFonts(ICON_FONT_SOURCES);

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
      <View style={styles.toastHost} pointerEvents="box-none">
        <Toast config={appToastConfig} topOffset={Platform.OS === 'web' ? 12 : 48} />
      </View>
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
  toastHost: Platform.select({
    web: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 999999,
    },
    default: {},
  }),
});
