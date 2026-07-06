import { WatermarkSurface } from '@/components/AppWatermark';
import { AppActiveGate } from '@/components/AppActiveGate';
import { EventOrchestrationListener } from '@/components/EventOrchestrationListener';
import { TotemDeviceRouteGuard } from '@/components/TotemDeviceRouteGuard';
import { AppDrawerProvider } from '@/context/AppDrawerContext';
import { EntityPrefixProvider } from '@/context/EntityPrefixContext';
import { PaletteProvider } from '@/context/PaletteContext';
import { useProfileScreenVisitTracker } from '@/hooks/useProfileScreenVisitTracker';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
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
  useProfileScreenVisitTracker();
  const showWatermark = !isWatermarkExcludedRoute(pathname, segments);
  const appStyle = [styles.app, { backgroundColor: MINIMAL_UI.background }];

  const routed = (
    <AppActiveGate>
      <TotemDeviceRouteGuard />
      <EventOrchestrationListener />
      <Slot />
    </AppActiveGate>
  );

  if (!showWatermark) {
    return (
      <EntityPrefixProvider>
        <View style={appStyle}>{routed}</View>
      </EntityPrefixProvider>
    );
  }

  return (
    <EntityPrefixProvider>
      <WatermarkSurface style={appStyle} routeKey={pathname}>
        {routed}
      </WatermarkSurface>
    </EntityPrefixProvider>
  );
}

export function AppShell() {
  return (
    <PaletteProvider>
      <AppDrawerProvider>
        <AppShellContent />
      </AppDrawerProvider>
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});
