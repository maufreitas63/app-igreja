import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { FAIL_CLOSED_REDIRECT_PATH } from '@/lib/failClosedNavigation';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type ScreenAccessGateProps = {
  status: ScreenAccessStatus;
  children: React.ReactNode;
  /** Destino ao negar acesso (evita ficar preso em «Redirecionando...» no web). */
  deniedRedirectPath?: Href | string;
};

export function ScreenAccessGate({
  status,
  children,
  deniedRedirectPath = FAIL_CLOSED_REDIRECT_PATH,
}: ScreenAccessGateProps) {
  const router = useRouter();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (status !== 'denied') {
      redirectedRef.current = false;
      return;
    }

    if (redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    router.replace(deniedRedirectPath as Href);
  }, [deniedRedirectPath, router, status]);

  if (status === 'allowed' || status === 'skipped') {
    return <>{children}</>;
  }

  if (status === 'checking') {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={MINIMAL_UI.blueDark} size="large" />
        <Text style={styles.gateText}>Verificando permissão...</Text>
      </View>
    );
  }

  return (
    <View style={styles.gate}>
      <ActivityIndicator color={MINIMAL_UI.blueDark} size="large" />
      <Text style={styles.gateText}>Redirecionando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: MINIMAL_UI.background,
  },
  gateText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
