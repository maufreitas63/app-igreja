import { CloseButton } from '@/components/minimal/CloseFooterBar';
import { FontAwesome } from '@expo/vector-icons';
import { KNOWLEDGE_PERMISSION_NOTE } from '@/lib/knowledge/copy';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { KnowledgeListItem } from '@/lib/knowledge/types';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  article: KnowledgeListItem | null;
  onClose: () => void;
};

type BodyBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string };

function parseKnowledgeBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const chunks = body.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const chunk of chunks) {
    const text = chunk.trim();
    if (!text) continue;
    if (text.startsWith('## ')) {
      const newline = text.indexOf('\n');
      if (newline === -1) {
        blocks.push({ type: 'heading', text: text.slice(3).trim() });
      } else {
        blocks.push({ type: 'heading', text: text.slice(3, newline).trim() });
        const remainder = text.slice(newline + 1).trim();
        if (remainder) blocks.push({ type: 'paragraph', text: remainder });
      }
      continue;
    }
    blocks.push({ type: 'paragraph', text });
  }

  return blocks;
}

export function KnowledgeArticleModal({ visible, article, onClose }: Props) {
  const blocks = useMemo(
    () => (article ? parseKnowledgeBody(article.body) : []),
    [article]
  );

  if (!article) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar ajuda" />
        <View style={styles.panel}>
          <View style={styles.header}>
            <FontAwesome name="info-circle" size={20} color={MINIMAL_UI.icon} />
            <Text style={styles.title}>{article.title}</Text>
          </View>
          {article.question ? <Text style={styles.question}>{article.question}</Text> : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {blocks.map((block, index) =>
              block.type === 'heading' ? (
                <Text key={`h-${index}`} style={styles.sectionTitle}>
                  {block.text}
                </Text>
              ) : (
                <Text key={`p-${index}`} style={styles.body}>
                  {block.text}
                </Text>
              )
            )}
            <Text style={styles.permissionNote}>{KNOWLEDGE_PERMISSION_NOTE}</Text>
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
    justifyContent: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  panel: {
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    padding: 20,
    gap: 14,
    zIndex: 2,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: MINIMAL_UI.text,
  },
  question: {
    fontSize: 14,
    lineHeight: 20,
    color: MINIMAL_UI.textMuted,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: MINIMAL_UI.blue,
  },
  permissionNote: {
    fontSize: 13,
    lineHeight: 20,
    color: MINIMAL_UI.textMuted,
  },
});
