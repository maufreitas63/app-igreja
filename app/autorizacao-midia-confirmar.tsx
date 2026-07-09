import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useMediaAuthorizationAccess } from '@/hooks/useMediaAuthorizationAccess';
import { confirmMediaAuthorization } from '@/lib/mediaAuthorization';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function MediaAuthorizationConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { sessionProfileId } = useMediaAuthorizationAccess();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Validando seu link de confirmação...');

  useEffect(() => {
    if (!token?.trim()) {
      setStatus('error');
      setMessage('Link inválido. Solicite um novo envio pelo aplicativo.');
      return;
    }

    let active = true;

    void (async () => {
      try {
        const result = await confirmMediaAuthorization({
          token: token.trim(),
          ipAddress: null,
          userAgent: Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : null,
        });

        if (!active) {
          return;
        }

        setStatus(result.ok ? 'success' : 'error');
        setMessage(result.message);
      } catch (error) {
        console.error('[autorizacao-midia-confirmar] failed', error);
        if (active) {
          setStatus('error');
          setMessage('Não foi possível confirmar a autorização.');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <MinimalScreenLayout scroll={false}>
      <View style={styles.root}>
        <Text style={styles.title}>Confirmação de autorização</Text>
        {status === 'loading' ? <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} /> : null}
        <Text style={[styles.message, status === 'error' && styles.messageError]}>{message}</Text>
        {status !== 'loading' ? (
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => {
              if (sessionProfileId) {
                router.replace({
                  pathname: '/autorizacao-midia',
                  params: withMinimalPresentation(),
                });
                return;
              }

              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.buttonText}>Voltar ao aplicativo</Text>
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
});
