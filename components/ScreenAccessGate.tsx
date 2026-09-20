import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { FAIL_CLOSED_REDIRECT_PATH, MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { ghostBlocksHomeBounce } from '@/lib/ghostNavigation';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const ghostActive = ghostBlocksHomeBounce();

  useEffect(() => {
    if (status !== 'denied') {
      redirectedRef.current = false;
      return;
    }

    if (ghostActive) {
      return;
    }

    if (redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    router.replace(deniedRedirectPath as Href);
  }, [deniedRedirectPath, ghostActive, router, status]);

  if (status === 'allowed' || status === 'skipped' || status === 'checking') {
    return <>{children}</>;
  }

  if (ghostActive) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Sem acesso nesta simulação</Text>
        <Text style={styles.gateText}>
          A pessoa do Modo Ghost não tem permissão para esta tela. Use o botão abaixo para voltar
          ao Início sem encerrar a simulação.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao Início"
          onPress={() => router.replace(MEMBER_HOME_PATH as Href)}
          style={styles.gateClose}
        >
          <Text style={styles.gateCloseText}>Voltar ao Início</Text>
        </Pressable>
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
  gateTitle: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  gateText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  gateClose: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateCloseText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '700',
  },
});
