import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { buildInlinePdfViewerUrl, isApkShellWebClient } from '@/lib/pdfViewerUrl';

/** Abre ou compartilha um arquivo/URI de PDF (blob: em web; file/https no nativo). */
export async function openPdfUri(pdfUrl: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // No APK (WebView): window.open(pdf) forçava download; abre viewer embutido.
    if (isApkShellWebClient() || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) {
      window.open(buildInlinePdfViewerUrl(pdfUrl), '_blank', 'noopener,noreferrer');
      return;
    }
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(pdfUrl, {
        mimeType: 'application/pdf',
        dialogTitle: 'Abrir PDF',
      });
      return;
    } catch {
      // fallback Linking
    }
  }

  await Linking.openURL(pdfUrl);
}
