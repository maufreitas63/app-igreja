import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import {
  getKnowledgeEditorCapabilities,
  listKnowledgeArticlesAdmin,
  unpublishKnowledgeArticle,
  upsertKnowledgeArticle,
} from '@/lib/knowledge/knowledgeApi';
import { KNOWLEDGE_ROLE_OPTIONS, KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import type { KnowledgeArticle, KnowledgeEditorCapabilities } from '@/lib/knowledge/types';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { confirmDialog } from '@/lib/confirmDialog';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

const EMPTY_FORM = {
  id: null as string | null,
  slug: '',
  title: '',
  question: '',
  body: '',
  route_key: KNOWLEDGE_ROUTE.home,
  is_platform: true,
  is_published: true,
  sort_order: 100,
  role_codes: ['member', 'congregado', 'visitante'] as string[],
};

function useKnowledgeEditorAccess(): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setStatus('checking');
        try {
          const caps = await getKnowledgeEditorCapabilities();
          if (!active) return;
          if (!caps.can_edit) {
            setStatus('denied');
            denyScreenAccessAndRedirect(
              router,
              MEMBER_HOME_PATH,
              'Acesso negado',
              'Apenas Super Administrador ou Secretaria editam a base de conhecimento.'
            );
            // Proteção aplicada: Gestor não tem visibilidade do Super Administrador
            return;
          }
          setStatus('allowed');
        } catch {
          if (!active) return;
          setStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            MEMBER_HOME_PATH,
            'Acesso negado',
            'Não foi possível validar o acesso.'
          );
        }
      })();
      return () => {
        active = false;
      };
    }, [router])
  );

  return status;
}

export default function ConhecimentoScreen() {
  const accessStatus = useKnowledgeEditorAccess();
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [caps, setCaps] = useState<KnowledgeEditorCapabilities>({
    can_edit: false,
    can_edit_platform: false,
    can_edit_tenant: false,
  });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const [nextCaps, rows] = await Promise.all([
        getKnowledgeEditorCapabilities(),
        listKnowledgeArticlesAdmin(search),
      ]);
      setCaps(nextCaps);
      setArticles(rows);
      if (!nextCaps.can_edit_platform) {
        setForm((current) => ({ ...current, is_platform: false }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load(query);
    }, query.trim() ? 280 : 0);
    return () => clearTimeout(handle);
  }, [load, query]);

  const startNew = () => {
    setForm({
      ...EMPTY_FORM,
      is_platform: caps.can_edit_platform,
    });
    setEditing(true);
  };

  const startEdit = (article: KnowledgeArticle) => {
    setForm({
      id: article.id,
      slug: article.slug,
      title: article.title,
      question: article.question,
      body: article.body,
      route_key: article.route_key,
      is_platform: article.tenant_id == null,
      is_published: article.is_published,
      sort_order: article.sort_order,
      role_codes: article.role_codes.length ? article.role_codes : EMPTY_FORM.role_codes,
    });
    setEditing(true);
  };

  const toggleRole = (code: string) => {
    setForm((current) => {
      const has = current.role_codes.includes(code);
      return {
        ...current,
        role_codes: has
          ? current.role_codes.filter((item) => item !== code)
          : [...current.role_codes, code],
      };
    });
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.title.trim() || !form.body.trim() || !form.route_key.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Artigo incompleto',
        text2: 'Preencha slug, título, rota e texto.',
      });
      return;
    }
    if (!form.role_codes.length) {
      Toast.show({
        type: 'error',
        text1: 'Papéis',
        text2: 'Selecione ao menos um papel que pode ver o artigo.',
      });
      return;
    }

    setSaving(true);
    try {
      const result = await upsertKnowledgeArticle({
        id: form.id,
        slug: form.slug,
        title: form.title,
        question: form.question,
        body: form.body,
        route_key: form.route_key,
        is_platform: caps.can_edit_platform ? form.is_platform : false,
        is_published: form.is_published,
        sort_order: form.sort_order,
        role_codes: form.role_codes,
      });
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: result.success ? 'Artigo salvo' : 'Não foi possível salvar',
        text2: result.message,
      });
      if (result.success) {
        setEditing(false);
        await load(query);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async (article: KnowledgeArticle) => {
    const confirmed = await confirmDialog(
      'Arquivar artigo',
      `Ocultar «${article.title}» da ajuda e do catálogo?`,
      'Arquivar',
      'Cancelar'
    );
    if (!confirmed) return;
    const result = await unpublishKnowledgeArticle(article.id);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: result.success ? 'Artigo arquivado' : 'Falha ao arquivar',
      text2: result.message,
    });
    if (result.success) {
      await load(query);
    }
  };

  const routeOptions = useMemo(() => Object.values(KNOWLEDGE_ROUTE), []);

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <Text style={styles.title}>Base de conhecimento</Text>
        <Text style={styles.hint}>
          Super Administrador edita artigos da plataforma. Secretaria edita só o texto local desta
          igreja. O Gestor de acesso não edita.
        </Text>

        {editing ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={form.slug}
              onChangeText={(value) => setForm((current) => ({ ...current, slug: value }))}
              placeholder="slug (ex.: perfil-identidade)"
              placeholderTextColor={MINIMAL_UI.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
              placeholder="Título"
              placeholderTextColor={MINIMAL_UI.textMuted}
            />
            <TextInput
              style={styles.input}
              value={form.question}
              onChangeText={(value) => setForm((current) => ({ ...current, question: value }))}
              placeholder="Pergunta (Como faço…?)"
              placeholderTextColor={MINIMAL_UI.textMuted}
            />
            <TextInput
              style={styles.input}
              value={form.route_key}
              onChangeText={(value) => setForm((current) => ({ ...current, route_key: value }))}
              placeholder="Chave da rota"
              placeholderTextColor={MINIMAL_UI.textMuted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Rotas do primeiro lote</Text>
            <View style={styles.chips}>
              {routeOptions.map((routeKey) => (
                <Pressable
                  key={routeKey}
                  onPress={() => setForm((current) => ({ ...current, route_key: routeKey }))}
                  style={[
                    styles.chip,
                    form.route_key === routeKey && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      form.route_key === routeKey && styles.chipTextActive,
                    ]}
                  >
                    {routeKey}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              value={form.body}
              onChangeText={(value) => setForm((current) => ({ ...current, body: value }))}
              placeholder="Texto (use ## Título para seções)"
              placeholderTextColor={MINIMAL_UI.textMuted}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Papéis que veem o artigo</Text>
            <View style={styles.chips}>
              {KNOWLEDGE_ROLE_OPTIONS.map((role) => {
                const active = form.role_codes.includes(role.code);
                return (
                  <Pressable
                    key={role.code}
                    onPress={() => toggleRole(role.code)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {role.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {caps.can_edit_platform ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Artigo da plataforma (todas as igrejas)</Text>
                <AppSwitch
                  value={form.is_platform}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, is_platform: value }))
                  }
                />
              </View>
            ) : null}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Publicado</Text>
              <AppSwitch
                value={form.is_published}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, is_published: value }))
                }
              />
            </View>
            <Pressable
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={() => void handleSave()}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Salvando…' : 'Salvar artigo'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setEditing(false)}>
              <Text style={styles.secondaryButtonText}>Voltar à lista</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.primaryButton} onPress={startNew}>
              <Text style={styles.primaryButtonText}>Novo artigo</Text>
            </Pressable>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar artigos"
                placeholderTextColor={MINIMAL_UI.textMuted}
                autoCapitalize="none"
              />
            </View>
            {loading ? (
              <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
            ) : articles.length === 0 ? (
              <Text style={styles.empty}>Nenhum artigo nesta busca.</Text>
            ) : (
              <View style={styles.list}>
                {articles.map((article) => (
                  <View key={article.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{article.title}</Text>
                    <Text style={styles.cardMeta}>
                      {article.tenant_id ? 'Igreja local' : 'Plataforma'} · {article.route_key}
                      {article.is_published ? '' : ' · rascunho'}
                    </Text>
                    <View style={styles.cardActions}>
                      <Pressable onPress={() => startEdit(article)}>
                        <Text style={styles.openLinkText}>Editar</Text>
                      </Pressable>
                      {article.is_published ? (
                        <Pressable onPress={() => void handleUnpublish(article)}>
                          <Text style={styles.dangerLink}>Arquivar</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </MinimalScreenLayout>
    </ScreenAccessGate>
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
    marginBottom: 12,
  },
  form: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MINIMAL_UI.text,
    fontSize: 15,
    backgroundColor: MINIMAL_UI.background,
  },
  bodyInput: {
    minHeight: 180,
  },
  fieldLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  chipText: {
    color: MINIMAL_UI.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    marginHorizontal: 16,
    backgroundColor: MINIMAL_UI.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blue,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  searchRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    paddingVertical: 10,
    borderWidth: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as const } : null),
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    padding: 24,
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
    gap: 6,
  },
  cardTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  cardMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  openLinkText: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  dangerLink: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
});
