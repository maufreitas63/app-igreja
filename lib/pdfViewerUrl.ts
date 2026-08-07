/**
 * Detecção de cliente embutido no APK (WebView shell).
 * O shell nativo define applicationNameForUserAgent=ComunidadeDigitalAPK.
 */
export function isApkShellWebClient(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  return /ComunidadeDigitalAPK/i.test(ua);
}

/**
 * URL de visualização embutida (funciona no WebView Android, que não renderiza PDF nativo no iframe).
 * Usa PDF.js hospedado na própria PWA (public/pdfjs) quando em produção; fallback CDN.
 */
export function buildInlinePdfViewerUrl(pdfUrl: string): string {
  const file = encodeURIComponent(pdfUrl);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/pdfjs/viewer.html?file=${file}`;
  }
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${file}`;
}
