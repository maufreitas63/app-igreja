// app/_layout.tsx
import { Buffer } from 'buffer';

import { AppBackHandler } from '@/components/AppBackHandler';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost';
import { GhostModeBanner } from '@/components/GhostModeBanner';
import { PwaAppShell } from '@/components/PwaAppShell';
import { GhostModeProvider } from '@/context/GhostModeContext';
import { appToastConfig } from '@/components/ui/appToastConfig';
import { isApkPwaShellEnabled } from '@/lib/apkRuntimeMode';
import { installExecutionErrorClipboard } from '@/lib/appToast';
import { ICON_FONT_SOURCES } from '@/lib/iconFonts';
import { installWebTextSelectionGuard, WEB_NON_SELECTABLE_VIEW_STYLES } from '@/lib/webTextSelectionGuard';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

if (!global.Buffer) {
  global.Buffer = Buffer;
}

installExecutionErrorClipboard();

const FONT_WAIT_TIMEOUT_MS = 2500;

export default function RootLayout() {
  // APK EAS com EXPO_PUBLIC_APK_SHELL_MODE=pwa: mesma experiência da PWA em produção.
  const usePwaShell = Platform.OS !== 'web' && isApkPwaShellEnabled();
  const [iconFontsLoaded, iconFontError] = useFonts(usePwaShell ? {} : ICON_FONT_SOURCES);
  const [fontsTimedOut, setFontsTimedOut] = useState(usePwaShell);

  useEffect(() => installWebTextSelectionGuard(), []);

  useEffect(() => {
    if (usePwaShell) {
      return;
    }

    const timer = setTimeout(() => setFontsTimedOut(true), FONT_WAIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [usePwaShell]);

  const fontsReady = usePwaShell || iconFontsLoaded || Boolean(iconFontError) || fontsTimedOut;

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync().catch(() => {
        // já oculta ou plugin ainda não montou
      });
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return (
      <View style={styles.fontLoader}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (usePwaShell) {
    return <PwaAppShell />;
  }

  return (
    <GhostModeProvider>
      <View style={styles.root}>
        <AppBackHandler />
        <AppShell />
        <GhostModeBanner />
        <ConfirmDialogHost />
        <View style={styles.toastHost} pointerEvents="box-none">
          <Toast config={appToastConfig} topOffset={Platform.OS === 'web' ? 12 : 48} />
        </View>
      </View>
    </GhostModeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...WEB_NON_SELECTABLE_VIEW_STYLES,
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
