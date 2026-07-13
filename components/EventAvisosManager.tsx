import { usePalette } from '@/context/PaletteContext';
import {
  deleteEventAviso,
  fetchOrchestratorEventAvisos,
  saveEventAviso,
  type EventAvisoRow,
} from '@/lib/eventAvisosApi';
import { showAppToast } from '@/lib/appToast';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  minimal?: boolean;
  /** Abre o formulário já expandido (útil quando é o único conteúdo do painel). */
  defaultExpanded?: boolean;
};

const MINIMAL_SWITCH_TRACK = { false: MINIMAL_UI.divider, true: MINIMAL_UI.accent } as const;

const emptyDraft = () => ({
  id: null as string | null,
  title: '',
  body: '',
  sortOrder: 0,
  isPublished: true,
});

export function EventAvisosManager({
  isActive = true,
  minimal = false,
  defaultExpanded = false,
}: Props) {
  const { colors } = usePalette();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<EventAvisoRow[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const loadAvisos = useCallback(async () => {
    if (!isActive || !expanded) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rows = await fetchOrchestratorEventAvisos();
      setItems(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar avisos.');
    } finally {
      setLoading(false);
    }
  }, [expanded, isActive]);

  useEffect(() => {
    void loadAvisos();
  }, [loadAvisos]);

  const resetDraft = () => {
    setDraft(emptyDraft());
  };

  const handleEdit = (row: EventAvisoRow) => {
    setDraft({
      id: row.id,
      title: row.title,
      body: row.body,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
    });
  };

  const handleSave = async () => {
    if (!draft.body.trim()) {
      showAppToast({ type: 'error', text1: 'Avisos', text2: 'Informe o texto do aviso.' });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await saveEventAviso({
        id: draft.id,
        title: draft.title,
        body: draft.body,
        sortOrder: draft.sortOrder,
        isPublished: draft.isPublished,
      });

      if (!result.success) {
        setError(result.message);
        showAppToast({ type: 'error', text1: 'Avisos', text2: result.message });
        return;
      }

      showAppToast({ type: 'success', text1: 'Avisos', text2: result.message });
      resetDraft();
      await loadAvisos();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar o aviso.';
      setError(message);
      showAppToast({ type: 'error', text1: 'Avisos', text2: message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setError(null);

    try {
      const result = await deleteEventAviso(id);

      if (!result.success) {
        setError(result.message);
        showAppToast({ type: 'error', text1: 'Avisos', text2: result.message });
        return;
      }

      if (draft.id === id) {
        resetDraft();
      }

      showAppToast({ type: 'success', text1: 'Avisos', text2: result.message });
      await loadAvisos();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir o aviso.';
      setError(message);
      showAppToast({ type: 'error', text1: 'Avisos', text2: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={[
        styles.wrapper,
        minimal && styles.wrapperMinimal,
        !minimal && { borderColor: `${colors.accent}55` },
      ]}
    >
      <Pressable
        style={[styles.headerRow, minimal && styles.headerRowMinimal]}
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel="Gerenciar avisos do culto"
      >
        <Text
          style={[
            styles.headerTitle,
            minimal && styles.headerTitleMinimal,
            !minimal && { color: colors.accent },
          ]}
        >
          Gerenciar avisos
        </Text>
        <Text style={[styles.headerHint, minimal && styles.headerHintMinimal]}>
          {expanded ? 'Ocultar' : 'Abrir'}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={[styles.body, minimal && styles.bodyMinimal]}>
          <Text style={[styles.helpText, minimal && styles.helpTextMinimal]}>
            Avisos publicados aparecem na home dos membros (página Avisos do pager).
          </Text>

          {loading ? (
            <ActivityIndicator color={minimal ? MINIMAL_UI.accent : colors.accent} />
          ) : null}
          {error ? (
            <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
          ) : null}

          <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>
            Título (opcional)
          </Text>
          <TextInput
            style={[styles.input, minimal && styles.inputMinimal]}
            value={draft.title}
            onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
            placeholder="Ex.: Culto de domingo"
            placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
            editable={!saving}
          />

          <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>Texto do aviso</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, minimal && styles.inputMinimal]}
            value={draft.body}
            onChangeText={(body) => setDraft((current) => ({ ...current, body }))}
            placeholder="Digite o comunicado para os membros..."
            placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
            multiline
            textAlignVertical="top"
            editable={!saving}
          />

          <View style={styles.publishRow}>
            <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>Publicado</Text>
            <Switch
              value={draft.isPublished}
              onValueChange={(isPublished) => setDraft((current) => ({ ...current, isPublished }))}
              disabled={saving}
              trackColor={minimal ? MINIMAL_SWITCH_TRACK : undefined}
              thumbColor={minimal ? MINIMAL_UI.onDark : undefined}
            />
          </View>

          <View style={[styles.actionsRow, minimal && styles.actionsRowMinimal]}>
            <Pressable
              style={[
                styles.primaryButton,
                minimal && styles.primaryButtonMinimal,
                !minimal && { backgroundColor: colors.primary },
              ]}
              onPress={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0F172A'} />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonText,
                    minimal && styles.primaryButtonTextMinimal,
                  ]}
                >
                  {draft.id ? 'Atualizar aviso' : 'Salvar aviso'}
                </Text>
              )}
            </Pressable>
            {draft.id ? (
              <Pressable
                style={[styles.secondaryButton, minimal && styles.secondaryButtonMinimal]}
                onPress={resetDraft}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    minimal && styles.secondaryButtonTextMinimal,
                  ]}
                >
                  Cancelar edição
                </Text>
              </Pressable>
            ) : null}
          </View>

          {items.length ? (
            <View style={styles.list}>
              <Text style={[styles.listTitle, minimal && styles.listTitleMinimal]}>
                Avisos cadastrados ({items.length})
              </Text>
              {items.map((item) => (
                <View key={item.id} style={[styles.listItem, minimal && styles.listItemMinimal]}>
                  <View style={styles.listItemHeader}>
                    <Text
                      style={[styles.listItemTitle, minimal && styles.listItemTitleMinimal]}
                      numberOfLines={1}
                    >
                      {item.title.trim() || 'Sem título'}
                    </Text>
                    <Text
                      style={[
                        styles.listItemBadge,
                        minimal && styles.listItemBadgeMinimal,
                        minimal &&
                          (item.isPublished
                            ? styles.listItemBadgePublishedMinimal
                            : styles.listItemBadgeDraftMinimal),
                      ]}
                    >
                      {item.isPublished ? 'Publicado' : 'Rascunho'}
                    </Text>
                  </View>
                  <Text
                    style={[styles.listItemBody, minimal && styles.listItemBodyMinimal]}
                    numberOfLines={3}
                  >
                    {item.body}
                  </Text>
                  <View style={styles.listItemActions}>
                    <Pressable onPress={() => handleEdit(item)} disabled={saving}>
                      <Text
                        style={[
                          styles.linkAction,
                          minimal && styles.linkActionMinimal,
                          !minimal && { color: colors.accent },
                        ]}
                      >
                        Editar
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void handleDelete(item.id)} disabled={saving}>
                      <Text
                        style={[
                          styles.deleteAction,
                          minimal && styles.deleteActionMinimal,
                        ]}
                      >
                        Excluir
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 0,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  wrapperMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerRowMinimal: {
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    paddingRight: 8,
  },
  headerTitleMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  headerHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  headerHintMinimal: {
    color: MINIMAL_UI.textMuted,
    fontWeight: '600',
  },
  body: {
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
  },
  bodyMinimal: {
    paddingHorizontal: 12,
    borderTopColor: MINIMAL_UI.divider,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    flexShrink: 1,
    maxWidth: '100%',
  },
  helpTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  fieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    fontSize: 14,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  inputMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.text,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  inputMultiline: {
    minHeight: 88,
  },
  publishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionsRowMinimal: {
    flexDirection: 'column',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  primaryButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 132,
    alignItems: 'center',
  },
  primaryButtonMinimal: {
    backgroundColor: MINIMAL_UI.accent,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButtonTextMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '600',
  },
  list: {
    gap: 8,
    marginTop: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  listTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
  },
  listTitleMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  listItem: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
  },
  listItemMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
    width: '100%',
  },
  listItemTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  listItemTitleMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  listItemBadge: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  listItemBadgeMinimal: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  listItemBadgePublishedMinimal: {
    color: '#15803D',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  listItemBadgeDraftMinimal: {
    color: MINIMAL_UI.textMuted,
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  listItemBody: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  listItemBodyMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
  },
  linkAction: {
    fontSize: 12,
    fontWeight: '800',
  },
  linkActionMinimal: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
  },
  deleteAction: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteActionMinimal: {
    color: '#DC2626',
    fontWeight: '700',
  },
});
