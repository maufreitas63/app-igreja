import { CloseButton } from '@/components/minimal/CloseFooterBar';
import { AssemblyMinutesPdfModal } from '@/components/AssemblyMinutesPdfModal';
import { isPdfLikeUrl, type SmallGroupGuide } from '@/lib/smallGroupsApi';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  guide: SmallGroupGuide | null;
  onClose: () => void;
};

export function SmallGroupGuideModal({ visible, guide, onClose }: Props) {
  const pdfUrl = guide && isPdfLikeUrl(guide.video_url) ? guide.video_url : null;

  if (pdfUrl) {
    return (
      <AssemblyMinutesPdfModal
        visible={visible}
        title={guide?.title ?? 'Roteiro da Semana'}
        pdfUrl={pdfUrl}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.kicker}>{guide?.module_title ?? 'Temas da Trilha'}</Text>
          <Text style={styles.title}>{guide?.title ?? 'Roteiro da Semana'}</Text>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} nestedScrollEnabled>
            {guide?.content ? (
              <Text style={styles.content}>{guide.content}</Text>
            ) : (
              <Text style={styles.empty}>Nenhum conteúdo publicado para esta semana.</Text>
            )}
            {guide?.reflection_question ? (
              <Text style={styles.reflection}>Reflexão: {guide.reflection_question}</Text>
            ) : null}
          </ScrollView>

          <CloseButton onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  kicker: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    color: '#1E3A5F',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    minHeight: 120,
  },
  bodyContent: {
    paddingVertical: 8,
    gap: 10,
  },
  content: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  reflection: {
    color: '#1E3A5F',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  empty: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
