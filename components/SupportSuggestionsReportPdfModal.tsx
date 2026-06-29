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
  pdfUrl: string | null;
  requestCount: number;
  onClose: () => void;
};

const openPdfInNewTab = (pdfUrl: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.open(pdfUrl, '_blank', 'noopener,noreferrer');
};

const downloadPdf = (pdfUrl: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = pdfUrl;
  anchor.download = `relatorio-sugestoes-melhorias-${new Date().toISOString().slice(0, 10)}.pdf`;
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
  if (!visible || !pdfUrl) {
    return null;
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar visualização do PDF" />

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
              <FontAwesome name="times" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.viewerShell}>
              {/* iframe é suportado apenas na web */}
              <iframe
                src={pdfUrl}
                title="Relatório de Sugestões e Melhorias"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: 10,
                  backgroundColor: '#FFFFFF',
                }}
              />
            </View>
          ) : (
            <View style={styles.nativeFallback}>
              <Text style={styles.nativeFallbackText}>
                A visualização embutida do PDF está disponível na versão web. Use o botão abaixo para abrir o arquivo.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => openPdfInNewTab(pdfUrl)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Abrir em nova aba</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => downloadPdf(pdfUrl)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Baixar PDF</Text>
                </TouchableOpacity>
              </>
            ) : null}
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
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 920,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
  },
  viewerShell: {
    flex: 1,
    minHeight: 420,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  nativeFallback: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 10,
    padding: 16,
    justifyContent: 'center',
  },
  nativeFallbackText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#C084FC',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
});
