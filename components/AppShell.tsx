import { WatermarkSurface } from '@/components/AppWatermark';
import { EventOrchestrationListener } from '@/components/EventOrchestrationListener';
import { TotemDeviceRouteGuard } from '@/components/TotemDeviceRouteGuard';
import { EntityPrefixProvider } from '@/context/EntityPrefixContext';
import { PaletteProvider } from '@/context/PaletteContext';
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
    || normalized === '/sessao-encerrada'
  );
};

export function AppShell() {
  const pathname = usePathname();
  const segments = useSegments();
  useProfileScreenVisitTracker();
  const showWatermark = !isWatermarkExcludedRoute(pathname, segments);

  if (!showWatermark) {
    return (
      <PaletteProvider>
        <EntityPrefixProvider>
          <View style={styles.app}>
            <TotemDeviceRouteGuard />
            <EventOrchestrationListener />
            <Slot />
          </View>
        </EntityPrefixProvider>
      </PaletteProvider>
    );
  }

  return (
    <PaletteProvider>
      <EntityPrefixProvider>
        <WatermarkSurface style={styles.app} routeKey={pathname}>
          <TotemDeviceRouteGuard />
          <EventOrchestrationListener />
          <Slot />
        </WatermarkSurface>
      </EntityPrefixProvider>
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});
