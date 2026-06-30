import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
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

const openPdfInNewTab = (pdfUrl: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.open(pdfUrl, '_blank', 'noopener,noreferrer');
};

export function AssemblyMinutesPdfModal({ visible, title, pdfUrl, onClose }: Props) {
  if (!visible || !pdfUrl) {
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
              <FontAwesome name="times" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.viewerShell}>
              <iframe src={pdfUrl} title={title} style={styles.iframe as never} />
            </View>
          ) : (
            <View style={styles.nativeFallback}>
              <Text style={styles.nativeFallbackText}>
                Visualização embutida disponível na versão web. Use o botão abaixo para abrir o PDF.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openPdfInNewTab(pdfUrl)}
              activeOpacity={0.85}
            >
              <FontAwesome name="external-link" size={14} color="#DBEAFE" />
              <Text style={styles.actionButtonText}>Abrir em nova aba</Text>
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
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 920,
    maxHeight: '92%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.9)',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#E0F2FE',
    fontSize: 16,
    fontWeight: '800',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51, 65, 85, 0.65)',
  },
  viewerShell: {
    flex: 1,
    minHeight: 420,
    backgroundColor: '#111827',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    minHeight: 420,
  },
  nativeFallback: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  nativeFallbackText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.9)',
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(30, 64, 175, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '800',
  },
  closeButton: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#60A5FA',
    paddingHorizontal: 14,
  },
  closeButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
});
