import {
  normalizeInstanceCode,
  persistPreferredIgrejaCode,
} from '@/lib/tenantSession';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Deep link de convite: `appigreja://configurar?codigo=IBEP`
 * ou `https://app-igreja.pages.dev/configurar?codigo=IBEP`.
 * Captura o código e envia para a tela de login.
 */
export default function ConfigurarInstanciaScreen() {
  const router = useRouter();
  const { codigo, igreja, code } = useLocalSearchParams<{
    codigo?: string | string[];
    igreja?: string | string[];
    code?: string | string[];
  }>();

  useEffect(() => {
    const first = (value?: string | string[]) =>
      typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? '' : '';
    const raw = first(codigo) || first(igreja) || first(code);
    const normalized = normalizeInstanceCode(raw);

    void (async () => {
      if (normalized) {
        await persistPreferredIgrejaCode(normalized);
      }
      router.replace({
        pathname: '/',
        params: normalized ? { igreja: normalized, codigo: normalized } : {},
      });
    })();
  }, [codigo, code, igreja, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={MINIMAL_UI.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
});
