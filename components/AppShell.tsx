import { WatermarkSurface } from '@/components/AppWatermark';
import { AppActiveGate } from '@/components/AppActiveGate';
import { EventOrchestrationListener } from '@/components/EventOrchestrationListener';
import { TotemDeviceRouteGuard } from '@/components/TotemDeviceRouteGuard';
import { EntityPrefixProvider } from '@/context/EntityPrefixContext';
import { PaletteProvider, usePalette } from '@/context/PaletteContext';
import { useProfileScreenVisitTracker } from '@/hooks/useProfileScreenVisitTracker';
import { Slot, usePathname, useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Telas públicas sem marca d'água (login, cadastro, totem). Índice do app fica em `(tabs)`. */
const isWatermarkExcludedRoute = (pathname: string, segments: string[]) => {
  if (segments[0] === '(tabs)') {
    return false;
  }

  const normalized = normalizePathname(pathname);
  return (
    normalized === '/'
    || normalized === '/index'
    || normalized === '/register'
    || normalized === '/totem-checkin'
    || normalized === '/forgot-password'
    || normalized === '/sessao-encerrada'
  );
};

function AppShellContent() {
  const pathname = usePathname();
  const segments = useSegments();
  const { colors } = usePalette();
  useProfileScreenVisitTracker();
  const showWatermark = !isWatermarkExcludedRoute(pathname, segments);
  const appStyle = [styles.app, { backgroundColor: colors.background }];

  if (!showWatermark) {
    return (
      <EntityPrefixProvider>
        <View style={appStyle}>
          <AppActiveGate>
            <TotemDeviceRouteGuard />
            <EventOrchestrationListener />
            <Slot />
          </AppActiveGate>
        </View>
      </EntityPrefixProvider>
    );
  }

  return (
    <EntityPrefixProvider>
      <WatermarkSurface style={appStyle} routeKey={pathname}>
        <AppActiveGate>
          <TotemDeviceRouteGuard />
          <EventOrchestrationListener />
          <Slot />
        </AppActiveGate>
      </WatermarkSurface>
    </EntityPrefixProvider>
  );
}

export function AppShell() {
  return (
    <PaletteProvider>
      <AppShellContent />
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});
