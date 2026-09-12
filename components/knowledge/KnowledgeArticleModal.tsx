import { CenteredCloseDialog } from '@/components/minimal/CenteredCloseDialog';
import { KNOWLEDGE_PERMISSION_NOTE } from '@/lib/knowledge/copy';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { KnowledgeListItem } from '@/lib/knowledge/types';
import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

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
    <CenteredCloseDialog
      visible={visible}
      onClose={onClose}
      title={article.title}
      subtitle={article.question || null}
      accessibilityCloseLabel="Fechar ajuda"
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
    </CenteredCloseDialog>
  );
}

const styles = StyleSheet.create({
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
