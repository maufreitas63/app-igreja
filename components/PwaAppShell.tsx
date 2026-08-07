import {
  downloadAndOpenShellFile,
  openShellExternalUrl,
  shouldHandoffShellNavigation,
} from '@/lib/pwaShellNavigation';
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
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
} from 'react-native-webview/lib/WebViewTypes';

const FIRST_LOAD_TIMEOUT_MS = 25_000;

/**
 * Intercepta window.open, target=_blank e links whatsapp/tel/pdf no PWA,
 * encaminhando ao shell nativo (Linking / download) em vez de quebrar o WebView.
 */
const SHELL_BRIDGE_JS = `
(function() {
  if (window.__cdApkShellBridge) { return true; }
  window.__cdApkShellBridge = true;

  function post(type, url) {
    try {
      if (window.ReactNativeWebView && url) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: String(type || 'open'),
          url: String(url)
        }));
      }
    } catch (e) {}
  }

  var origOpen = window.open;
  window.open = function(url) {
    if (url) {
      post('open', url);
      return null;
    }
    try {
      return origOpen ? origOpen.apply(window, arguments) : null;
    } catch (e) {
      return null;
    }
  };

  document.addEventListener('click', function(e) {
    var node = e.target;
    while (node && node.tagName !== 'A') {
      node = node.parentElement;
    }
    if (!node) { return; }
    var abs = node.href || '';
    if (!abs) { return; }
    var target = (node.getAttribute('target') || '').toLowerCase();
    var hasDownload = node.hasAttribute('download');
    var isApp = /^(whatsapp|whatsapp-api|tel|mailto|sms|smsto|intent|market|geo):/i.test(abs);
    var isWa = /wa\\.me|whatsapp\\.com/i.test(abs);
    var isFile = /\\.(pdf|docx?|xlsx?|pptx?|zip)(\\?|#|$)/i.test(abs);
    if (isApp || isWa || hasDownload || target === '_blank' || isFile) {
      e.preventDefault();
      e.stopPropagation();
      post(isFile || hasDownload ? 'download' : 'open', abs);
    }
  }, true);

  return true;
})();
true;
`;

/**
 * Shell nativo: carrega o PWA de produção dentro do APK.
 * Trata safe area inferior, WhatsApp e downloads de PDF.
 */
export function PwaAppShell() {
  const entryUrl = useMemo(() => resolvePwaShellEntryUrl(), []);
  const webRef = useRef<WebViewType | null>(null);
  const firstPaintDoneRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().catch(() => {
      // best-effort
    });
  }, []);

  useEffect(() => {
    if (!loading || errorMessage) {
      return;
    }

    const timer = setTimeout(() => {
      if (!firstPaintDoneRef.current) {
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

  const handoffUrl = useCallback(async (url: string, forcedMode?: 'external' | 'download') => {
    const decision = shouldHandoffShellNavigation(url);
    const mode = forcedMode ?? decision.mode;

    if (mode === 'download' || isLikelyPdfNavigation(url)) {
      await downloadAndOpenShellFile(url);
      return;
    }

    // WhatsApp, tel, target=_blank (window.open), etc. → app/navegador do SO.
    await openShellExternalUrl(url);
  }, []);

  const handleShellMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const raw = event.nativeEvent.data;
        const data = JSON.parse(raw) as { type?: string; url?: string };
        const url = data.url?.trim();
        if (!url) {
          return;
        }
        const type = (data.type || 'open').toLowerCase();
        void handoffUrl(url, type === 'download' ? 'download' : 'external');
      } catch {
        // ignore non-json messages
      }
    },
    [handoffUrl]
  );

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => {
      const url = request.url?.trim() ?? '';
      if (!url || url === 'about:blank') {
        return true;
      }

      const decision = shouldHandoffShellNavigation(url);
      if (decision.handoff) {
        void handoffUrl(url, decision.mode === 'download' ? 'download' : 'external');
        return false;
      }

      return true;
    },
    [handoffUrl]
  );

  const handleError = useCallback(
    (event: {
      nativeEvent?: { description?: string; code?: number; url?: string };
    }) => {
      const description = event.nativeEvent?.description?.trim() || '';
      const code = event.nativeEvent?.code;
      const failedUrl = event.nativeEvent?.url?.trim() || '';

      // Link whatsapp:// caiu no WebView — volta e tenta openURL nativo.
      if (
        code === -10
        || /ERR_UNKNOWN_URL_SCHEME/i.test(description)
        || isExternalAppLike(failedUrl)
      ) {
        if (failedUrl) {
          void openShellExternalUrl(failedUrl);
        }
        if (webRef.current && firstPaintDoneRef.current) {
          webRef.current.goBack();
        }
        setLoading(false);
        return;
      }

      if (firstPaintDoneRef.current) {
        return;
      }

      setErrorMessage(
        description || 'Não foi possível carregar o aplicativo. Verifique a internet.'
      );
      setLoading(false);
    },
    []
  );

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
    // bottom incluso: barra de gestos / botões do Android não cobrem o PWA.
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
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
            if (navState.loading === false && navState.url) {
              markFirstPaintDone();
            }
          }}
          onContentProcessDidTerminate={retry}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onMessage={handleShellMessage}
          injectedJavaScriptBeforeContentLoaded={SHELL_BRIDGE_JS}
          injectedJavaScript={SHELL_BRIDGE_JS}
          onOpenWindow={(event) => {
            const targetUrl = event.nativeEvent?.targetUrl?.trim();
            if (targetUrl) {
              void handoffUrl(targetUrl, isLikelyPdfNavigation(targetUrl) ? 'download' : 'external');
            }
          }}
          onFileDownload={({ nativeEvent }) => {
            const downloadUrl = nativeEvent?.downloadUrl?.trim();
            if (downloadUrl) {
              void downloadAndOpenShellFile(downloadUrl);
            }
          }}
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          geolocationEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures
          // true: captura window.open / target=_blank em onOpenWindow
          setSupportMultipleWindows
          originWhitelist={['*']}
          mixedContentMode="always"
          cacheEnabled
          androidLayerType="hardware"
          mediaCapturePermissionGrantType={
            Platform.OS === 'ios' ? 'grantIfSameHostElsePrompt' : undefined
          }
          applicationNameForUserAgent="ComunidadeDigitalAPK"
          startInLoadingState={false}
          // Android: melhora entrega de links de download Content-Disposition
          {...(Platform.OS === 'android'
            ? {
                nestedScrollEnabled: true,
              }
            : {})}
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

function isLikelyPdfNavigation(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url) || url.toLowerCase().includes('.pdf');
}

function isExternalAppLike(url: string): boolean {
  return /^(whatsapp|whatsapp-api|tel|mailto|intent|market):/i.test(url.trim());
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
