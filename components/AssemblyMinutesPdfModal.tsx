import { FontAwesome } from '@expo/vector-icons';
import { openPdfUri } from '@/lib/openPdfUri';
import { buildInlinePdfViewerUrl, isApkShellWebClient } from '@/lib/pdfViewerUrl';
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
  title: string;
  pdfUrl: string | null;
  onClose: () => void;
};

export function AssemblyMinutesPdfModal({ visible, title, pdfUrl, onClose }: Props) {
  const viewerSrc = useMemo(() => {
    if (!pdfUrl) {
      return null;
    }
    // WebView Android (APK) não renderiza PDF cru no iframe — usa PDF.js embutido.
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
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar PDF" />

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
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
              <iframe src={viewerSrc} title={title} style={styles.iframe as never} />
            </View>
          ) : (
            <View style={styles.nativeFallback}>
              <Text style={styles.nativeFallbackText}>
                No aplicativo, use o botão abaixo para abrir ou compartilhar o PDF.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                void openPdfUri(pdfUrl);
              }}
              activeOpacity={0.85}
            >
              <FontAwesome name="external-link" size={14} color={MINIMAL_UI.blueDark} />
              <Text style={styles.actionButtonText}>
                {Platform.OS === 'web' ? 'Abrir em nova aba' : 'Abrir / compartilhar'}
              </Text>
            </TouchableOpacity>
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
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
    minWidth: 0,
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '700',
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
    border: 'none',
    minHeight: 420,
    backgroundColor: MINIMAL_UI.background,
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
    lineHeight: 18,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: MINIMAL_UI.divider,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 14,
  },
  closeButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 12,
    fontWeight: '700',
  },
});
