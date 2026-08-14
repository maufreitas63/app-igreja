import { FontAwesome } from '@expo/vector-icons';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { shareFinancialSummaryPdfFile } from '@/lib/financialAnalyticalSummaryShare';
import { buildInlinePdfViewerUrl, isApkShellWebClient } from '@/lib/pdfViewerUrl';
import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  title: string;
  previewUrl: string | null;
  pdfBlob: Blob | null;
  fileName: string | null;
  signedUrl: string | null;
  onClose: () => void;
};

export function FinancialSummaryPdfModal({
  visible,
  title,
  previewUrl,
  pdfBlob,
  fileName,
  signedUrl,
  onClose,
}: Props) {
  const [sharing, setSharing] = React.useState(false);

  const viewerSrc = useMemo(() => {
    if (!previewUrl) {
      return null;
    }
    if (Platform.OS === 'web' && isApkShellWebClient()) {
      return buildInlinePdfViewerUrl(previewUrl);
    }
    return previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      setSharing(false);
    };
  }, [previewUrl]);

  if (!visible || !previewUrl || !viewerSrc) {
    return null;
  }

  const handleShare = async () => {
    if (!pdfBlob || !fileName || sharing) {
      return;
    }

    setSharing(true);
    try {
      const shared = await shareFinancialSummaryPdfFile({
        blob: pdfBlob,
        fileName,
        signedUrl,
      });
      Toast.show({
        type: 'success',
        text1: 'Resumo financeiro',
        text2: shared
          ? 'Escolha o WhatsApp na lista de compartilhar para enviar o PDF.'
          : 'Não foi possível abrir o compartilhar do dispositivo.',
        visibilityTime: 7000,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Resumo financeiro',
        text2: error instanceof Error ? error.message : 'Não foi possível compartilhar o PDF.',
        visibilityTime: 7000,
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar PDF" />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => void handleShare()}
                disabled={sharing}
                activeOpacity={0.85}
                accessibilityLabel="Compartilhar PDF pelo aplicativo do dispositivo"
              >
                {sharing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <FontAwesome name="whatsapp" size={14} color="#FFFFFF" />
                    <Text style={styles.shareButtonText}>Compartilhar</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeIconButton}
                onPress={onClose}
                activeOpacity={0.85}
                accessibilityLabel="Fechar"
              >
                <FontAwesome name="times" size={16} color={MINIMAL_UI.icon} />
              </TouchableOpacity>
            </View>
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.viewerShell}>
              <iframe src={viewerSrc} title={title} style={styles.iframe as never} />
            </View>
          ) : (
            <View style={styles.nativeFallback}>
              <Text style={styles.nativeFallbackText}>
                Use Compartilhar para enviar o PDF pelo WhatsApp.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 920,
    maxHeight: '92%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.divider,
  },
  title: {
    flex: 1,
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  closeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  viewerShell: {
    flex: 1,
    minHeight: 480,
    backgroundColor: '#FFFFFF',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    minHeight: 480,
    backgroundColor: '#FFFFFF',
  },
  nativeFallback: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  nativeFallbackText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
