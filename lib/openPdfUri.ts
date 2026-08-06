import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Abre ou compartilha um arquivo/URI de PDF (blob: em web; file/https no nativo). */
export async function openPdfUri(pdfUrl: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
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
