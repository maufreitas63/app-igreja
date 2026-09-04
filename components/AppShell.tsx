import { WatermarkSurface } from '@/components/AppWatermark';
import { AppActiveGate } from '@/components/AppActiveGate';
import { AppBillingGate } from '@/components/AppBillingGate';
import { DevClickTraceBootstrap } from '@/components/DevClickTraceBootstrap';
import { EventOrchestrationListener } from '@/components/EventOrchestrationListener';
import { PastoralAppointmentReminderListener } from '@/components/PastoralAppointmentReminderListener';
import { ScaleSwapNoticesListener } from '@/components/ScaleSwapNoticesListener';
import { TotemDeviceRouteGuard } from '@/components/TotemDeviceRouteGuard';
import { AppDrawerProvider } from '@/context/AppDrawerContext';
import { EntityPrefixProvider } from '@/context/EntityPrefixContext';
import { PaletteProvider } from '@/context/PaletteContext';
import { useProfileScreenVisitTracker } from '@/hooks/useProfileScreenVisitTracker';
import {
  DEFAULT_WEB_DOCUMENT_TITLE,
  useWebDocumentTitle,
} from '@/hooks/useWebDocumentTitle';
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
    || normalized === '/baixar-app'
    || normalized === '/sessao-encerrada'
    || normalized === '/configurar'
  );
};

function AppShellContent() {
  const pathname = usePathname();
  const segments = useSegments();
  useProfileScreenVisitTracker();
  useWebDocumentTitle(DEFAULT_WEB_DOCUMENT_TITLE);
  const showWatermark = !isWatermarkExcludedRoute(pathname, segments);
  const appStyle = [styles.app, { backgroundColor: MINIMAL_UI.background }];

  const routed = (
    <AppActiveGate>
      <AppBillingGate>
        <DevClickTraceBootstrap />
        <TotemDeviceRouteGuard />
        <EventOrchestrationListener />
        <PastoralAppointmentReminderListener />
        <ScaleSwapNoticesListener />
        <Slot />
      </AppBillingGate>
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
