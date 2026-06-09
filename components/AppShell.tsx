import { WatermarkSurface } from '@/components/AppWatermark';
import { TotemDeviceRouteGuard } from '@/components/TotemDeviceRouteGuard';
import { Slot, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Só a tela de login/senha na raiz — não confundir com `/(tabs)/index` (índice de etiquetas). */
const isLoginRoute = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  return normalized === '/' || normalized === '/index';
};

export function AppShell() {
  const pathname = usePathname();
  const showWatermark = !isLoginRoute(pathname);

  if (!showWatermark) {
    return (
      <View style={styles.app}>
        <TotemDeviceRouteGuard />
        <Slot />
      </View>
    );
  }

  return (
    <WatermarkSurface style={styles.app}>
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
