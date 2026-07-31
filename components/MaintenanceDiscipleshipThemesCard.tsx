import {
  fetchDiscipleshipTrailAdmin,
  saveDiscipleshipLessonAdmin,
  saveDiscipleshipModuleAdmin,
  type DiscipleshipAdminLesson,
  type DiscipleshipAdminModule,
} from '@/lib/discipleshipTrailAdmin';
import { isMinisterialGiftsLesson } from '@/lib/discipleshipMinisterialLesson';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

type LessonDraft = {
  title: string;
  content: string;
  video_url: string;
  reflection_question: string;
  is_active: boolean;
};

/** Área de trabalho: editar temas/conteúdo da Trilha da igreja da sessão. */
export function MaintenanceDiscipleshipThemesCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const [modules, setModules] = useState<DiscipleshipAdminModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [moduleTitleDraft, setModuleTitleDraft] = useState<Record<string, string>>({});
  const [moduleDescDraft, setModuleDescDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchDiscipleshipTrailAdmin();
      setModules(rows);
      const titles: Record<string, string> = {};
      const descs: Record<string, string> = {};
      for (const module of rows) {
        titles[module.id] = module.title;
        descs[module.id] = module.description ?? '';
      }
      setModuleTitleDraft(titles);
      setModuleDescDraft(descs);
      setExpandedModuleId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (err) {
      setModules([]);
      setError(err instanceof Error ? err.message : 'Falha ao carregar temas da Trilha.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void load();
  }, [isActive, load]);

  const openLessonEditor = (lesson: DiscipleshipAdminLesson) => {
    setEditingLessonId(lesson.id);
    setDraft({
      title: lesson.title,
      content: lesson.content ?? '',
      video_url: lesson.video_url ?? '',
      reflection_question: lesson.reflection_question ?? '',
      is_active: lesson.is_active,
    });
  };

  const handleSaveModule = async (module: DiscipleshipAdminModule) => {
    const title = (moduleTitleDraft[module.id] ?? module.title).trim();
    if (title.length < 2) {
      Toast.show({ type: 'error', text1: 'Título do módulo obrigatório' });
      return;
    }
    setSaving(true);
    try {
      await saveDiscipleshipModuleAdmin({
        id: module.id,
        title,
        description: moduleDescDraft[module.id] ?? '',
        sort_order: module.sort_order,
        is_active: module.is_active,
      });
      Toast.show({ type: 'success', text1: 'Módulo salvo', text2: title });
      await load();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao salvar módulo',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLesson = async (lesson: DiscipleshipAdminLesson) => {
    if (!draft) return;
    const title = draft.title.trim();
    if (title.length < 2) {
      Toast.show({ type: 'error', text1: 'Título da lição obrigatório' });
      return;
    }
    setSaving(true);
    try {
      await saveDiscipleshipLessonAdmin({
        id: lesson.id,
        module_id: lesson.module_id,
        title,
        content: draft.content,
        video_url: draft.video_url,
        reflection_question: draft.reflection_question,
        sort_order: lesson.sort_order,
        is_active: draft.is_active,
      });
      Toast.show({ type: 'success', text1: 'Lição salva', text2: title });
      setEditingLessonId(null);
      setDraft(null);
      await load();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao salvar lição',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLesson = async (module: DiscipleshipAdminModule) => {
    setSaving(true);
    try {
      const id = await saveDiscipleshipLessonAdmin({
        module_id: module.id,
        title: `Nova lição ${module.lessons.length + 1}`,
        content: '',
        video_url: '',
        reflection_question: '',
        is_active: true,
      });
      Toast.show({ type: 'success', text1: 'Lição criada' });
      await load();
      setExpandedModuleId(module.id);
      setEditingLessonId(id);
      setDraft({
        title: `Nova lição ${module.lessons.length + 1}`,
        content: '',
        video_url: '',
        reflection_question: '',
        is_active: true,
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao criar lição',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  return (
    <View style={[maintenancePanelStyles.panel, { height: contentHeight }]}>
      <Text style={minimal ? styles.titleMinimal : styles.title}>Temas da Trilha</Text>
      <Text style={styles.subtitle}>
        Conteúdo exclusivo desta igreja. Edite textos, vídeos e reflexões dos passos da Trilha
        para disponibilizar aos participantes.
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={MINIMAL_UI.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {modules.map((module) => {
            const expanded = expandedModuleId === module.id;
            return (
              <View key={module.id} style={styles.moduleCard}>
                <TouchableOpacity
                  style={styles.moduleHeader}
                  onPress={() => setExpandedModuleId(expanded ? null : module.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.moduleHeaderCopy}>
                    <Text style={styles.moduleOrder}>Passo {module.sort_order}</Text>
                    <Text style={styles.moduleTitle}>{module.title}</Text>
                    <Text style={styles.moduleMeta}>
                      {module.lessons.length} lição{module.lessons.length === 1 ? '' : 'ões'}
                      {module.is_active ? '' : ' · inativo'}
                    </Text>
                  </View>
                  <FontAwesome
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={MINIMAL_UI.icon}
                  />
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.moduleBody}>
                    <Text style={styles.fieldLabel}>Título do módulo</Text>
                    <TextInput
                      style={styles.input}
                      value={moduleTitleDraft[module.id] ?? ''}
                      onChangeText={(value) =>
                        setModuleTitleDraft((prev) => ({ ...prev, [module.id]: value }))
                      }
                    />
                    <Text style={styles.fieldLabel}>Descrição / propósito</Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      multiline
                      value={moduleDescDraft[module.id] ?? ''}
                      onChangeText={(value) =>
                        setModuleDescDraft((prev) => ({ ...prev, [module.id]: value }))
                      }
                    />
                    <TouchableOpacity
                      style={styles.saveModuleBtn}
                      disabled={saving}
                      onPress={() => void handleSaveModule(module)}
                    >
                      <Text style={styles.saveModuleBtnText}>Salvar módulo</Text>
                    </TouchableOpacity>

                    <Text style={styles.lessonsHeading}>Lições</Text>
                    {module.lessons.map((lesson) => {
                      const editing = editingLessonId === lesson.id && draft;
                      return (
                        <View key={lesson.id} style={styles.lessonCard}>
                          <TouchableOpacity
                            style={styles.lessonHeader}
                            onPress={() => {
                              if (editing) {
                                setEditingLessonId(null);
                                setDraft(null);
                                return;
                              }
                              openLessonEditor(lesson);
                            }}
                          >
                            <Text style={styles.lessonTitle}>
                              {lesson.sort_order}. {lesson.title}
                            </Text>
                            <FontAwesome
                              name={editing ? 'times' : 'pencil'}
                              size={14}
                              color={MINIMAL_UI.accent}
                            />
                          </TouchableOpacity>

                          {editing ? (
                            <View style={styles.lessonEditor}>
                              <Text style={styles.fieldLabel}>Título</Text>
                              <TextInput
                                style={styles.input}
                                value={draft.title}
                                onChangeText={(title) => setDraft({ ...draft, title })}
                              />
                              <Text style={styles.fieldLabel}>Conteúdo (texto)</Text>
                              <TextInput
                                style={[styles.input, styles.inputMultilineTall]}
                                multiline
                                value={draft.content}
                                onChangeText={(content) => setDraft({ ...draft, content })}
                              />
                              {isMinisterialGiftsLesson(module, lesson) ? (
                                <View style={styles.ministerialNote}>
                                  <Text style={styles.fieldLabel}>Atividade desta lição</Text>
                                  <Text style={styles.ministerialNoteText}>
                                    Em vez de URL de vídeo, o participante vê o botão «Perfil
                                    Ministerial» para preencher o questionário de dons nesta etapa
                                    (passo 5.1).
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  <Text style={styles.fieldLabel}>URL do vídeo (opcional)</Text>
                                  <TextInput
                                    style={styles.input}
                                    autoCapitalize="none"
                                    value={draft.video_url}
                                    onChangeText={(video_url) => setDraft({ ...draft, video_url })}
                                    placeholder="https://..."
                                    placeholderTextColor={MINIMAL_UI.textMuted}
                                  />
                                </>
                              )}
                              <Text style={styles.fieldLabel}>Pergunta de reflexão (opcional)</Text>
                              <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                multiline
                                value={draft.reflection_question}
                                onChangeText={(reflection_question) =>
                                  setDraft({ ...draft, reflection_question })
                                }
                              />
                              <View style={styles.switchRow}>
                                <Text style={styles.fieldLabelInline}>Lição ativa</Text>
                                <Switch
                                  value={draft.is_active}
                                  onValueChange={(is_active) => setDraft({ ...draft, is_active })}
                                />
                              </View>
                              <TouchableOpacity
                                style={styles.saveLessonBtn}
                                disabled={saving}
                                onPress={() => void handleSaveLesson(lesson)}
                              >
                                <Text style={styles.saveLessonBtnText}>
                                  {saving ? 'Salvando...' : 'Salvar lição'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.addLessonBtn}
                      disabled={saving}
                      onPress={() => void handleAddLesson(module)}
                    >
                      <FontAwesome name="plus" size={12} color={MINIMAL_UI.accent} />
                      <Text style={styles.addLessonBtnText}>Nova lição neste passo</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleMinimal: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { gap: 10, paddingBottom: 16 },
  moduleCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: MINIMAL_UI.background,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  moduleHeaderCopy: { flex: 1, minWidth: 0, gap: 2 },
  moduleOrder: {
    color: MINIMAL_UI.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  moduleTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  moduleMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  moduleBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    padding: 12,
    gap: 8,
  },
  fieldLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldLabelInline: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: MINIMAL_UI.text,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  inputMultilineTall: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  ministerialNote: {
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: '#EFF6FF',
    padding: 10,
  },
  ministerialNoteText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  saveModuleBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveModuleBtnText: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  lessonsHeading: {
    marginTop: 6,
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  lessonCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.divider,
    borderRadius: 10,
    overflow: 'hidden',
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  lessonTitle: {
    flex: 1,
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  lessonEditor: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    padding: 10,
    gap: 8,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveLessonBtn: {
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.accent,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveLessonBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  addLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addLessonBtnText: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
  },
});
