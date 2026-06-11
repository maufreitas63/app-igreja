import { WatermarkSurface } from '@/components/AppWatermark';
import { TotemDeviceRouteGuard } from '@/components/TotemDeviceRouteGuard';
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
  const showWatermark = !isWatermarkExcludedRoute(pathname, segments);

  if (!showWatermark) {
    return (
      <View style={styles.app}>
        <TotemDeviceRouteGuard />
        <Slot />
      </View>
    );
  }

  return (
    <WatermarkSurface style={styles.app} routeKey={pathname}>
      <TotemDeviceRouteGuard />
      <Slot />
    </WatermarkSurface>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});
