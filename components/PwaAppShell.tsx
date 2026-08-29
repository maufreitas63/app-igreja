import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import {
  buildShellPdfViewerUri,
  downloadAndOpenShellFile,
  downloadAndShareImageFile,
  isAndroidHomeIntent,
  isExternalAppScheme,
  isPdfUrl,
  openShellExternalUrl,
  openWhatsAppShellUrl,
  shouldHandoffShellNavigation,
} from '@/lib/pwaShellNavigation';
import { resolvePwaShellEntryUrl } from '@/lib/apkRuntimeMode';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
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

const FIRST_LOAD_TIMEOUT_MS = 8_000;

/**
 * Bridge: WhatsApp / schemes externos → nativo.
 * PDF e window.open de PDF → visualizador embutido (não force download).
 * Não intercepta cliques genéricos _blank de navegação in-app.
 */
const SHELL_BRIDGE_JS = `
(function() {
  if (window.__cdApkShellBridgeV2) { return true; }
  window.__cdApkShellBridgeV2 = true;

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

  function isWa(u) {
    return /^(whatsapp|whatsapp-api):/i.test(u) || /wa\\.me|api\\.whatsapp\\.com|whatsapp\\.com/i.test(u);
  }
  function isApp(u) {
    return /^(whatsapp|whatsapp-api|tel|mailto|sms|smsto|market|geo):/i.test(u)
      || (/^intent:/i.test(u) && !/category\\.HOME/i.test(u));
  }
  function isPdf(u) {
    return /\\.pdf(\\?|#|$)/i.test(u) || /\\/object\\/(sign|public)\\/.*\\.pdf/i.test(u);
  }

  var origOpen = window.open;
  window.open = function(url) {
    if (!url) {
      try { return origOpen ? origOpen.apply(window, arguments) : null; } catch (e) { return null; }
    }
    var abs = String(url);
    if (isApp(abs) || isWa(abs)) {
      post('whatsapp', abs);
      return null;
    }
    if (isPdf(abs)) {
      post('pdf', abs);
      return null;
    }
    // Demais _blank: tenta manter no WebView via location (SPA) ou externo genérico
    post('open', abs);
    return null;
  };

  document.addEventListener('click', function(e) {
    var node = e.target;
    while (node && node.tagName !== 'A') {
      node = node.parentElement;
    }
    if (!node) { return; }
    var abs = node.href || '';
    if (!abs) { return; }
    if (isApp(abs) || isWa(abs)) {
      e.preventDefault();
      e.stopPropagation();
      post('whatsapp', abs);
      return;
    }
    if (isPdf(abs)) {
      e.preventDefault();
      e.stopPropagation();
      post('pdf', abs);
    }
  }, true);

  return true;
})();
true;
`;

export function PwaAppShell() {
  const entryUrl = useMemo(() => resolvePwaShellEntryUrl(), []);
  const webRef = useRef<WebViewType | null>(null);
  const firstPaintDoneRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(entryUrl);
  const [pdfViewerUri, setPdfViewerUri] = useState<string | null>(null);
  const allowFirstDocumentLoadRef = useRef(true);

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

    const isShellHomeUrl = (url: string) => {
      try {
        const { pathname } = new URL(url);
        const normalized = pathname.replace(/\/+$/, '') || '/';
        return (
          normalized === '/'
          || normalized === '/index'
          || normalized === '/(tabs)'
          || normalized === '/(tabs)/index'
        );
      } catch {
        return false;
      }
    };

    const navigateWebViewToHome = () => {
      const js = `
        (function() {
          try {
            if (typeof window !== 'undefined' && window.location) {
              var origin = window.location.origin || '';
              window.location.replace(origin + '/(tabs)');
            }
          } catch (e) {}
          true;
        })();
      `;
      webRef.current?.injectJavaScript(js);
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pdfViewerUri) {
        setPdfViewerUri(null);
        return true;
      }

      // Fora do Índice: sempre tela inicial (não webView.goBack → Perfil etc.).
      if (!isShellHomeUrl(currentUrl)) {
        navigateWebViewToHome();
        return true;
      }

      // No Índice: sempre diálogo Encerrar sessão (não sair do app em silêncio).
      if (isShellHomeUrl(currentUrl)) {
        void import('@/lib/userSession').then(({ confirmExitApplication }) => {
          void confirmExitApplication();
        });
        return true;
      }

      return false;
    });

    return () => sub.remove();
  }, [canGoBack, currentUrl, pdfViewerUri]);

  const markFirstPaintDone = useCallback(() => {
    firstPaintDoneRef.current = true;
    setLoading(false);
  }, []);

  const openInlinePdf = useCallback(
    (pdfUrl: string) => {
      const absolute = pdfUrl.trim();
      if (!absolute) {
        return;
      }
      setPdfViewerUri(buildShellPdfViewerUri(absolute, entryUrl));
    },
    [entryUrl]
  );

  const handoffUrl = useCallback(
    async (url: string, forcedMode?: 'external' | 'pdf' | 'download' | 'whatsapp') => {
      // "Abrir em nova aba" com viewer PDF.js da própria PWA.
      if (url.includes('/pdfjs/viewer.html')) {
        setPdfViewerUri(url);
        return;
      }

      const decision = shouldHandoffShellNavigation(url);
      const mode = forcedMode === 'whatsapp' ? 'external' : forcedMode ?? decision.mode;

      if (mode === 'pdf' || (!forcedMode && isPdfUrl(url)) || (mode === 'download' && isPdfUrl(url))) {
        openInlinePdf(url);
        return;
      }

      if (mode === 'download') {
        await downloadAndOpenShellFile(url);
        return;
      }

      if (forcedMode === 'whatsapp' || /wa\.me|whatsapp/i.test(url)) {
        await openWhatsAppShellUrl(url);
        return;
      }

      await openShellExternalUrl(url);
    },
    [openInlinePdf]
  );

  const handleShellMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          url?: string;
          mimeType?: string;
          fileName?: string;
        };
        const url = data.url?.trim();
        if (!url) {
          return;
        }
        if (url.includes('/pdfjs/viewer.html')) {
          setPdfViewerUri(url);
          return;
        }
        const type = (data.type || 'open').toLowerCase();
        if (type === 'share-image' || type === 'share-file') {
          void downloadAndShareImageFile(url, {
            mimeType: data.mimeType,
            fileName: data.fileName,
          });
          return;
        }
        if (type === 'pdf' || (type === 'download' && isPdfUrl(url))) {
          openInlinePdf(url);
          return;
        }
        if (type === 'whatsapp') {
          void openWhatsAppShellUrl(url);
          return;
        }
        if (type === 'download') {
          void downloadAndOpenShellFile(url);
          return;
        }
        void handoffUrl(url, isPdfUrl(url) ? 'pdf' : 'external');
      } catch {
        // ignore
      }
    },
    [handoffUrl, openInlinePdf]
  );

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => {
      const url = request.url?.trim() ?? '';
      if (!url || url === 'about:blank') {
        return true;
      }

      if (isAndroidHomeIntent(url)) {
        return false;
      }

      // Android WebView: bloquear o 1º documento ou same-origin deixa a ampulheta eterna.
      if (allowFirstDocumentLoadRef.current) {
        allowFirstDocumentLoadRef.current = false;
        if (!isExternalAppScheme(url)) {
          return true;
        }
      }

      try {
        const requestOrigin = new URL(url).origin;
        const entryOrigin = new URL(entryUrl).origin;
        if (requestOrigin === entryOrigin) {
          return true;
        }
      } catch {
        // segue para o handoff
      }

      // Visualizador PDF embutido no modal ou pdfjs.
      if (url.includes('/pdfjs/viewer.html')) {
        return true;
      }

      const decision = shouldHandoffShellNavigation(url);
      if (decision.handoff) {
        void handoffUrl(url, decision.mode === 'none' ? undefined : decision.mode);
        return false;
      }

      return true;
    },
    [entryUrl, handoffUrl]
  );

  const handleError = useCallback(
    (event: {
      nativeEvent?: { description?: string; code?: number; url?: string };
    }) => {
      const description = event.nativeEvent?.description?.trim() || '';
      const code = event.nativeEvent?.code;
      const failedUrl = event.nativeEvent?.url?.trim() || '';

      if (
        isAndroidHomeIntent(failedUrl)
        || code === -10
        || /ERR_UNKNOWN_URL_SCHEME/i.test(description)
        || /^(whatsapp|tel|mailto|intent):/i.test(failedUrl)
      ) {
        if (failedUrl && !isAndroidHomeIntent(failedUrl)) {
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
    allowFirstDocumentLoadRef.current = true;
    setErrorMessage(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  }, []);

  return (
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
            if (navState.url) {
              setCurrentUrl(navState.url);
            }
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
            if (!targetUrl) {
              return;
            }
            if (isPdfUrl(targetUrl)) {
              openInlinePdf(targetUrl);
              return;
            }
            void handoffUrl(targetUrl);
          }}
          onFileDownload={({ nativeEvent }) => {
            const downloadUrl = nativeEvent?.downloadUrl?.trim();
            if (!downloadUrl) {
              return;
            }
            if (isPdfUrl(downloadUrl)) {
              openInlinePdf(downloadUrl);
              return;
            }
            void downloadAndOpenShellFile(downloadUrl);
          }}
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          geolocationEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows
          originWhitelist={['*']}
          mixedContentMode="always"
          cacheEnabled
          mediaCapturePermissionGrantType={
            Platform.OS === 'ios' ? 'grantIfSameHostElsePrompt' : undefined
          }
          applicationNameForUserAgent="ComunidadeDigitalAPK"
          startInLoadingState={false}
          {...(Platform.OS === 'android' ? { nestedScrollEnabled: true } : {})}
        />
      )}

      <Modal
        visible={Boolean(pdfViewerUri)}
        animationType="slide"
        onRequestClose={() => setPdfViewerUri(null)}
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.pdfModal} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.pdfHeader}>
            <Text style={styles.pdfTitle} numberOfLines={1}>
              Documento PDF
            </Text>
          </View>
          {pdfViewerUri ? (
            <WebView
              source={{ uri: pdfViewerUri }}
              style={styles.pdfWebview}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.pdfLoader}>
                  <ActivityIndicator size="large" color="#10b981" />
                </View>
              )}
            />
          ) : null}
          <CloseFooterBar onPress={() => setPdfViewerUri(null)} />
        </SafeAreaView>
      </Modal>

      {loading && !errorMessage ? (
        <View style={styles.loader}>
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
    pointerEvents: 'none',
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
  pdfModal: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  pdfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pdfTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  pdfClose: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  pdfCloseText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
  },
  pdfWebview: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  pdfLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
