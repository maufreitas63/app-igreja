import { KnowledgeArticleModal } from '@/components/knowledge/KnowledgeArticleModal';
import { getKnowledgeArticleForRoute } from '@/lib/knowledge/knowledgeApi';
import type { KnowledgeArticle } from '@/lib/knowledge/types';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

type Props = {
  routeKey: string;
  iconColor?: string;
  size?: number;
  accessibilityLabel?: string;
};

/** Ícone «i» só aparece se existir artigo publicado visível para o papel efetivo. */
export function KnowledgeRouteInfo({
  routeKey,
  iconColor = MINIMAL_UI.icon,
  size = 20,
  accessibilityLabel,
}: Props) {
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setArticle(null);
    setOpen(false);

    void (async () => {
      const next = await getKnowledgeArticleForRoute(routeKey);
      if (active) setArticle(next);
    })();

    return () => {
      active = false;
    };
  }, [routeKey]);

  if (!article) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `Como usar: ${article.title}`}
        onPress={() => setOpen(true)}
        style={styles.button}
        hitSlop={8}
      >
        <FontAwesome name="info-circle" size={size} color={iconColor} />
      </Pressable>
      <KnowledgeArticleModal visible={open} article={article} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
