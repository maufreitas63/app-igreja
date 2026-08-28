import { FontAwesome } from '@expo/vector-icons';
import { SUPPORT_SUGGESTIONS_REPORT_PDF_FILENAME } from '@/lib/maintenanceSupportSuggestionsReport';
import { openPdfUri } from '@/lib/openPdfUri';
import { buildInlinePdfViewerUrl, isApkShellWebClient } from '@/lib/pdfViewerUrl';
import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  pdfUrl: string | null;
  requestCount: number;
  onClose: () => void;
};

const downloadPdf = (pdfUrl: string) => {
  if (typeof document === 'undefined') {
    void openPdfUri(pdfUrl);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = pdfUrl;
  anchor.download = SUPPORT_SUGGESTIONS_REPORT_PDF_FILENAME;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export function SupportSuggestionsReportPdfModal({
  visible,
  pdfUrl,
  requestCount,
  onClose,
}: Props) {
  const viewerSrc = useMemo(() => {
    if (!pdfUrl) {
      return null;
    }
    if (Platform.OS === 'web' && isApkShellWebClient()) {
      return buildInlinePdfViewerUrl(pdfUrl);
    }
    return pdfUrl;
  }, [pdfUrl]);

  if (!visible || !pdfUrl || !viewerSrc) {
    return null;
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Fechar visualização do PDF"
        />

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Relatório em PDF</Text>
              <Text style={styles.subtitle}>
                {requestCount.toLocaleString('pt-BR')} solicitação(ões) · uma ficha por página
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityLabel="Fechar"
            >
              <FontAwesome name="times" size={16} color={MINIMAL_UI.icon} />
            </TouchableOpacity>
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.viewerShell}>
              <iframe
                src={viewerSrc}
                title="Relatório de Sugestões e Melhorias"
                style={styles.iframe as never}
              />
            </View>
          ) : (
            <View style={styles.nativeFallback}>
              <Text style={styles.nativeFallbackText}>
                No aplicativo, use Abrir / compartilhar para enviar o PDF a outro app
                (Drive, WhatsApp, leitor de PDF).
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    void openPdfUri(pdfUrl);
                  }}
                  activeOpacity={0.85}
                >
                  <FontAwesome name="external-link" size={13} color={MINIMAL_UI.blueDark} />
                  <Text style={styles.secondaryButtonText}>Abrir em nova aba</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => downloadPdf(pdfUrl)}
                  activeOpacity={0.85}
                >
                  <FontAwesome name="download" size={13} color={MINIMAL_UI.onDark} />
                  <Text style={styles.primaryButtonText}>Baixar PDF</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  void openPdfUri(pdfUrl);
                }}
                activeOpacity={0.85}
              >
                <FontAwesome name="share-alt" size={13} color={MINIMAL_UI.onDark} />
                <Text style={styles.primaryButtonText}>Abrir / compartilhar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 16,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
    zIndex: 2,
    ...boxShadowStyle({
      color: '#0F172A',
      offsetY: 8,
      blurRadius: 24,
      opacity: 0.08,
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.divider,
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  viewerShell: {
    flex: 1,
    minHeight: 420,
    backgroundColor: MINIMAL_UI.background,
  },
  iframe: {
    width: '100%',
    height: '100%',
    minHeight: 420,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 0,
  },
  nativeFallback: {
    minHeight: 180,
    padding: 16,
    justifyContent: 'center',
  },
  nativeFallbackText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: MINIMAL_UI.divider,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
