// app/_layout.tsx
import '../global.css';
import { Buffer } from 'buffer';

if (!global.Buffer) {
  global.Buffer = Buffer;
}

import { AppBackHandler } from '@/components/AppBackHandler';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost';
import { GhostModeBanner } from '@/components/GhostModeBanner';
import { GhostModeProvider } from '@/context/GhostModeContext';
import { appToastConfig } from '@/components/ui/appToastConfig';
import { installExecutionErrorClipboard } from '@/lib/appToast';
import { ICON_FONT_SOURCES } from '@/lib/iconFonts';
import { installWebTextSelectionGuard, WEB_NON_SELECTABLE_VIEW_STYLES } from '@/lib/webTextSelectionGuard';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

installExecutionErrorClipboard();

export default function RootLayout() {
  const [iconFontsLoaded] = useFonts(ICON_FONT_SOURCES);

  useEffect(() => installWebTextSelectionGuard(), []);

  if (!iconFontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <GhostModeProvider>
      <View className="flex-1" style={WEB_NON_SELECTABLE_VIEW_STYLES}>
        <AppBackHandler />
        <AppShell />
        <GhostModeBanner />
        <ConfirmDialogHost />
        <View
          className="web:fixed web:inset-x-0 web:top-0 web:z-[999999]"
          pointerEvents="box-none"
        >
          <Toast config={appToastConfig} topOffset={Platform.OS === 'web' ? 12 : 48} />
        </View>
      </View>
    </GhostModeProvider>
  );
}
