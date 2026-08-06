import { resolvePwaShellEntryUrl } from '@/lib/apkRuntimeMode';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

/**
 * Shell nativo: carrega o PWA de produção dentro do APK.
 * Assim o instalável Android executa o mesmo código deployado no Cloudflare
 * (mapa Leaflet, Ghost, ACL, manutenção, etc.) sem divergência da stack RN.
 */
export function PwaAppShell() {
  const entryUrl = useMemo(() => resolvePwaShellEntryUrl(), []);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canMountWebView, setCanMountWebView] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Permissão SO: o WebView só expõe GPS à page se o app Android já concedeu.
        await Location.requestForegroundPermissionsAsync();
      } catch {
        // best-effort — mapa pede de novo na web se faltar
      } finally {
        if (!cancelled) {
          setCanMountWebView(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleError = useCallback((event: { nativeEvent?: { description?: string } }) => {
    const description = event.nativeEvent?.description?.trim();
    setErrorMessage(
      description || 'Não foi possível carregar o aplicativo. Verifique a internet.'
    );
    setLoading(false);
  }, []);

  const handleHttpError = useCallback((event: { nativeEvent?: { statusCode?: number } }) => {
    const status = event.nativeEvent?.statusCode;
    if (status && status >= 400) {
      setErrorMessage(`Falha ao abrir o app (HTTP ${status}). Tente novamente.`);
      setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    setErrorMessage(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Sem conexão com o app</Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Text style={styles.errorHint}>{entryUrl}</Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryLabel}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : canMountWebView ? (
        <WebView
          key={reloadKey}
          source={{ uri: entryUrl }}
          style={styles.webview}
          onLoadStart={() => {
            setLoading(true);
            setErrorMessage(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={handleError}
          onHttpError={handleHttpError}
          // PWA precisa de storage, geolocation e mídia no WebView Android/iOS.
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          geolocationEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          originWhitelist={['https://*', 'http://*']}
          mixedContentMode="compatibility"
          mediaCapturePermissionGrantType={
            Platform.OS === 'ios' ? 'grantIfSameHostElsePrompt' : undefined
          }
          startInLoadingState={false}
        />
      ) : null}

      {(loading || !canMountWebView) && !errorMessage ? (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loaderText}>Carregando Comunidade Digital…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  webview: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    gap: 12,
  },
  loaderText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  errorTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    color: '#cbd5e1',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryLabel: {
    color: '#042f2e',
    fontWeight: '700',
    fontSize: 15,
  },
});
