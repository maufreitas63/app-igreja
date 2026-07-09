import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useMediaAuthorizationAccess } from '@/hooks/useMediaAuthorizationAccess';
import { resolveAuthorizationConfirmToken } from '@/lib/authorizationConfirmToken';
import { confirmMediaAuthorization, loadLatestMediaAuthorization } from '@/lib/mediaAuthorization';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const RECENT_AUTHORIZATION_MS = 7 * 24 * 60 * 60 * 1000;

export default function MediaAuthorizationConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => resolveAuthorizationConfirmToken(params.token), [params.token]);
  const { sessionProfileId } = useMediaAuthorizationAccess();
  const [status, setStatus] = useState<'ready' | 'loading' | 'success' | 'error'>('ready');
  const [message, setMessage] = useState(
    'Toque em Confirmar autorização para concluir. O link vale por 48 horas.'
  );
  const confirmInFlightRef = useRef(false);
  const confirmedRef = useRef(false);

  const recoverRecentAuthorization = useCallback(async (): Promise<boolean> => {
    if (!sessionProfileId) {
      return false;
    }

    const latest = await loadLatestMediaAuthorization(sessionProfileId);
    if (!latest?.accepted_at) {
      return false;
    }

    const acceptedAtMs = new Date(latest.accepted_at).getTime();
    if (Number.isNaN(acceptedAtMs) || Date.now() - acceptedAtMs > RECENT_AUTHORIZATION_MS) {
      return false;
    }

    setStatus('success');
    setMessage('Sua autorização já estava confirmada. Obrigado!');
    confirmedRef.current = true;
    return true;
  }, [sessionProfileId]);

  const handleConfirm = useCallback(async () => {
    if (!token || confirmInFlightRef.current || confirmedRef.current) {
      return;
    }

    confirmInFlightRef.current = true;
    setStatus('loading');
    setMessage('Confirmando sua autorização...');

    try {
      const result = await confirmMediaAuthorization({
        token,
        ipAddress: null,
        userAgent: Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      if (result.ok) {
        setStatus('success');
        setMessage(result.message);
        confirmedRef.current = true;
        return;
      }

      const recovered = await recoverRecentAuthorization();
      if (recovered) {
        return;
      }

      setStatus('error');
      setMessage(result.message);
    } catch (error) {
      console.error('[autorizacao-midia-confirmar] failed', error);
      const recovered = await recoverRecentAuthorization();
      if (!recovered) {
        setStatus('error');
        setMessage('Não foi possível confirmar a autorização.');
      }
    } finally {
      confirmInFlightRef.current = false;
    }
  }, [recoverRecentAuthorization, token]);

  const handleBack = useCallback(() => {
    if (sessionProfileId) {
      router.replace({
        pathname: '/autorizacao-midia',
        params: withMinimalPresentation(),
      });
      return;
    }

    router.replace('/(tabs)');
  }, [router, sessionProfileId]);

  if (!token) {
    return (
      <MinimalScreenLayout scroll={false}>
        <View style={styles.root}>
          <Text style={styles.title}>Confirmação de autorização</Text>
          <Text style={[styles.message, styles.messageError]}>
            Link inválido ou incompleto. Copie o link inteiro do e-mail ou solicite um novo envio pelo aplicativo.
          </Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={handleBack}>
            <Text style={styles.buttonText}>Voltar ao aplicativo</Text>
          </Pressable>
        </View>
      </MinimalScreenLayout>
    );
  }

  return (
    <MinimalScreenLayout scroll={false}>
      <View style={styles.root}>
        <Text style={styles.title}>Confirmação de autorização</Text>
        {status === 'loading' ? <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} /> : null}
        <Text style={[styles.message, status === 'error' && styles.messageError]}>{message}</Text>

        {status === 'ready' ? (
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void handleConfirm()}>
            <Text style={styles.buttonText}>Confirmar autorização</Text>
          </Pressable>
        ) : null}

        {status === 'success' || status === 'error' ? (
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={handleBack}>
            <Text style={styles.secondaryButtonText}>Voltar ao aplicativo</Text>
          </Pressable>
        ) : null}
      </View>
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
    paddingTop: 8,
    gap: 16,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  loader: {
    marginTop: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: MINIMAL_UI.blue,
  },
  messageError: {
    color: '#DC2626',
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: MINIMAL_UI.blue,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blue,
    fontWeight: '700',
  },
});
