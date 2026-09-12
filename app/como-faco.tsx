import { KnowledgeArticleModal } from '@/components/knowledge/KnowledgeArticleModal';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { listKnowledgeArticles } from '@/lib/knowledge/knowledgeApi';
import { knowledgeCatalogFromParam, knowledgeRouteHref } from '@/lib/knowledge/routeKeys';
import type { KnowledgeListItem } from '@/lib/knowledge/types';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function ComoFacoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const catalog = knowledgeCatalogFromParam(params.catalog);
  const isMaintenanceCatalog = catalog === 'maintenance';
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<KnowledgeListItem[]>([]);
  const [selected, setSelected] = useState<KnowledgeListItem | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    try {
      setArticles(await listKnowledgeArticles(search, catalog));
    } finally {
      setLoading(false);
    }
  }, [catalog]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load(query);
    }, query.trim() ? 280 : 0);
    return () => clearTimeout(handle);
  }, [load, query]);

  return (
    <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
      <Text style={styles.title}>Como faço…?</Text>
      <Text style={styles.hint}>
        {isMaintenanceCatalog
          ? 'Ajuda das telas da engrenagem. Só entram artigos do seu papel nesta igreja.'
          : 'Ajuda do que você usa no dia a dia. Só entram artigos do seu papel nesta igreja.'}
      </Text>
      <View style={styles.searchRow}>
        <FontAwesome name="search" size={16} color={MINIMAL_UI.icon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Como faço…?"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Buscar na base de conhecimento"
        />
      </View>
      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : articles.length === 0 ? (
        <Text style={styles.empty}>
          {query.trim()
            ? 'Nenhum artigo visível para esta busca.'
            : 'Ainda não há artigos publicados para o seu papel.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {articles.map((article) => {
            const href = knowledgeRouteHref(article.route_key);
            return (
              <View key={article.id} style={styles.card}>
                <Pressable
                  onPress={() => setSelected(article)}
                  accessibilityRole="button"
                  accessibilityLabel={article.question || article.title}
                >
                  <Text style={styles.cardTitle}>{article.question || article.title}</Text>
                  {article.question && article.question !== article.title ? (
                    <Text style={styles.cardMeta}>{article.title}</Text>
                  ) : null}
                </Pressable>
                {href ? (
                  <Pressable
                    onPress={() => router.navigate(href)}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir tela: ${article.title}`}
                    style={styles.openLink}
                  >
                    <Text style={styles.openLinkText}>Abrir tela</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      <KnowledgeArticleModal
        visible={selected != null}
        article={selected}
        onClose={() => setSelected(null)}
      />
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: MINIMAL_UI.background,
  },
  searchInput: {
    flex: 1,
    color: MINIMAL_UI.text,
    fontSize: 15,
    paddingVertical: 8,
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: MINIMAL_UI.background,
  },
  cardTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  openLink: {
    alignSelf: 'flex-start',
  },
  openLinkText: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
