import { resolvePwaShellEntryUrl } from '@/lib/apkRuntimeMode';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';

const FIRST_LOAD_TIMEOUT_MS = 25_000;

/**
 * Shell nativo: carrega o PWA de produção dentro do APK.
 * Não bloqueia o WebView por permissões do SO — isso travava o loader
 * em "Carregando Comunidade Digital…".
 */
export function PwaAppShell() {
  const entryUrl = useMemo(() => resolvePwaShellEntryUrl(), []);
  const webRef = useRef<WebViewType | null>(null);
  const firstPaintDoneRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);

  // Permissão de GPS em paralelo — nunca impede o boot do PWA.
  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().catch(() => {
      // best-effort
    });
  }, []);

  // Escape hatch: se o Android não disparar onLoadEnd, tira o overlay.
  useEffect(() => {
    if (!loading || errorMessage) {
      return;
    }

    const timer = setTimeout(() => {
      if (!firstPaintDoneRef.current) {
        // Ainda pode estar carregando JS; some o splash para o usuário ver erros da página.
        firstPaintDoneRef.current = true;
        setLoading(false);
      }
    }, FIRST_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [loading, errorMessage, reloadKey]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [canGoBack]);

  const markFirstPaintDone = useCallback(() => {
    firstPaintDoneRef.current = true;
    setLoading(false);
  }, []);

  const handleError = useCallback((event: { nativeEvent?: { description?: string } }) => {
    if (firstPaintDoneRef.current) {
      return;
    }
    const description = event.nativeEvent?.description?.trim();
    setErrorMessage(
      description || 'Não foi possível carregar o aplicativo. Verifique a internet.'
    );
    setLoading(false);
  }, []);

  const handleHttpError = useCallback((event: { nativeEvent?: { statusCode?: number } }) => {
    if (firstPaintDoneRef.current) {
      return;
    }
    const status = event.nativeEvent?.statusCode;
    if (status && status >= 400) {
      setErrorMessage(`Falha ao abrir o app (HTTP ${status}). Tente novamente.`);
      setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    firstPaintDoneRef.current = false;
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
      ) : (
        <WebView
          ref={webRef}
          key={reloadKey}
          source={{ uri: entryUrl }}
          style={styles.webview}
          // Só o primeiro documento: navegação SPA / adminAccess não reabre o splash.
          onLoadEnd={() => markFirstPaintDone()}
          onLoadProgress={({ nativeEvent }) => {
            if (nativeEvent.progress >= 0.9) {
              markFirstPaintDone();
            }
          }}
          onError={handleError}
          onHttpError={handleHttpError}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            // SPA: primeiro paint costuma ser o entry; limpa overlay se a URL mudou e já havia conteúdo.
            if (navState.loading === false && navState.url) {
              markFirstPaintDone();
            }
          }}
          onContentProcessDidTerminate={retry}
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
          originWhitelist={['*']}
          mixedContentMode="always"
          cacheEnabled
          androidLayerType="hardware"
          mediaCapturePermissionGrantType={
            Platform.OS === 'ios' ? 'grantIfSameHostElsePrompt' : undefined
          }
          // Chrome Android UA melhora compatibilidade de mapas/geolocation em alguns WebViews antigos.
          applicationNameForUserAgent="ComunidadeDigitalAPK"
          startInLoadingState={false}
        />
      )}

      {loading && !errorMessage ? (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loaderText}>Carregando Comunidade Digital…</Text>
          <Text style={styles.loaderHint}>{entryUrl}</Text>
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
    paddingHorizontal: 24,
  },
  loaderText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  loaderHint: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
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
