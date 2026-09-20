import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { FAIL_CLOSED_REDIRECT_PATH } from '@/lib/failClosedNavigation';
import { ghostPassScreenAccess } from '@/lib/ghostNavigation';
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
  const ghostPass = ghostPassScreenAccess();

  useEffect(() => {
    if (status !== 'denied' || ghostPass) {
      redirectedRef.current = false;
      return;
    }

    if (redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    router.replace(deniedRedirectPath as Href);
  }, [deniedRedirectPath, ghostPass, router, status]);

  // Ghost: nunca cobrir a rota com «Sem acesso nesta simulação».
  if (ghostPass || status === 'allowed' || status === 'skipped' || status === 'checking') {
    return <>{children}</>;
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
