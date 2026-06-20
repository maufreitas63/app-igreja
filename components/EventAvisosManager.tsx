import { usePalette } from '@/context/PaletteContext';
import {
  deleteEventAviso,
  fetchOrchestratorEventAvisos,
  saveEventAviso,
  type EventAvisoRow,
} from '@/lib/eventAvisosApi';
import { showAppToast } from '@/lib/appToast';
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
};

const emptyDraft = () => ({
  id: null as string | null,
  title: '',
  body: '',
  sortOrder: 0,
  isPublished: true,
});

export function EventAvisosManager({ isActive = true }: Props) {
  const { colors } = usePalette();
  const [expanded, setExpanded] = useState(false);
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
    <View style={[styles.wrapper, { borderColor: `${colors.accent}55` }]}>
      <Pressable
        style={styles.headerRow}
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel="Gerenciar avisos do culto"
      >
        <Text style={[styles.headerTitle, { color: colors.accent }]}>Gerenciar avisos</Text>
        <Text style={styles.headerHint}>{expanded ? 'Ocultar' : 'Abrir'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.helpText}>
            Os avisos ficam na tabela <Text style={styles.helpMono}>event_avisos</Text> e aparecem
            na rota /avisos quando publicados.
          </Text>

          {loading ? <ActivityIndicator color={colors.accent} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.fieldLabel}>Título (opcional)</Text>
          <TextInput
            style={styles.input}
            value={draft.title}
            onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
            placeholder="Ex.: Culto de domingo"
            placeholderTextColor="#64748B"
            editable={!saving}
          />

          <Text style={styles.fieldLabel}>Texto do aviso</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={draft.body}
            onChangeText={(body) => setDraft((current) => ({ ...current, body }))}
            placeholder="Digite o comunicado para os membros..."
            placeholderTextColor="#64748B"
            multiline
            textAlignVertical="top"
            editable={!saving}
          />

          <View style={styles.publishRow}>
            <Text style={styles.fieldLabel}>Publicado</Text>
            <Switch
              value={draft.isPublished}
              onValueChange={(isPublished) => setDraft((current) => ({ ...current, isPublished }))}
              disabled={saving}
            />
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.primaryButtonText}>{draft.id ? 'Atualizar aviso' : 'Salvar aviso'}</Text>
              )}
            </Pressable>
            {draft.id ? (
              <Pressable style={styles.secondaryButton} onPress={resetDraft} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancelar edição</Text>
              </Pressable>
            ) : null}
          </View>

          {items.length ? (
            <View style={styles.list}>
              <Text style={styles.listTitle}>Avisos cadastrados ({items.length})</Text>
              {items.map((item) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={styles.listItemHeader}>
                    <Text style={styles.listItemTitle} numberOfLines={1}>
                      {item.title.trim() || 'Sem título'}
                    </Text>
                    <Text style={styles.listItemBadge}>{item.isPublished ? 'Publicado' : 'Rascunho'}</Text>
                  </View>
                  <Text style={styles.listItemBody} numberOfLines={3}>
                    {item.body}
                  </Text>
                  <View style={styles.listItemActions}>
                    <Pressable onPress={() => handleEdit(item)} disabled={saving}>
                      <Text style={[styles.linkAction, { color: colors.accent }]}>Editar</Text>
                    </Pressable>
                    <Pressable onPress={() => void handleDelete(item.id)} disabled={saving}>
                      <Text style={styles.deleteAction}>Excluir</Text>
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
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  headerHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  helpMono: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
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
  primaryButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 132,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: 8,
    marginTop: 8,
  },
  listTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
  },
  listItem: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listItemTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  listItemBadge: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  listItemBody: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
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
  deleteAction: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
  },
});
