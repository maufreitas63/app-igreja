import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type ScreenAccessGateProps = {
  status: ScreenAccessStatus;
  children: React.ReactNode;
};

export function ScreenAccessGate({ status, children }: ScreenAccessGateProps) {
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
