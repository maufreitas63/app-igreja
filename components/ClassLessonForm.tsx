import { CloseButton, CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { fetchClassLesson, saveClassLesson } from '@/lib/classLessonApi';
import { suggestClassLessonFamily } from '@/lib/classLessonFamilyApi';
import { getEventCalendarDate } from '@/lib/eventDate';
import { MINIMAL_SCREEN_PADDING_LEFT, MINIMAL_SCREEN_PADDING_RIGHT, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ClassRoomKey } from '@/types/class-lesson';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  eventId: string;
  eventDate: string | null;
  roomKey: ClassRoomKey;
  roomLabel: string;
  onClose: () => void;
};

const formatClassDate = (value: string | null) => {
  const iso = value ? getEventCalendarDate(value) ?? value.slice(0, 10) : '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

export function ClassLessonForm({
  visible,
  eventId,
  eventDate,
  roomKey,
  roomLabel,
  onClose,
}: Props) {
  const classDateLabel = formatClassDate(eventDate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [familyCopied, setFamilyCopied] = useState(false);
  const [title, setTitle] = useState('');
  const [biblePassage, setBiblePassage] = useState('');
  const [mainObjective, setMainObjective] = useState('');
  const [resourcesNotes, setResourcesNotes] = useState('');
  const [familyExtension, setFamilyExtension] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const lesson = await fetchClassLesson(eventId, roomKey);
        if (cancelled) {
          return;
        }
        setTitle(lesson?.title ?? '');
        setBiblePassage(lesson?.bible_passage ?? '');
        setMainObjective(lesson?.main_objective ?? '');
        setResourcesNotes(lesson?.resources_notes ?? '');
        setFamilyExtension(lesson?.family_extension ?? '');
      } catch (error) {
        if (!cancelled) {
          Toast.show({
            type: 'error',
            text1: 'Planejamento da aula',
            text2: error instanceof Error ? error.message : 'Não foi possível carregar.',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, roomKey, visible]);

  const handleSuggestFamily = async () => {
    if (suggesting || saving || loading) {
      return;
    }

    if (title.trim().length < 2 || biblePassage.trim().length < 1 || mainObjective.trim().length < 1) {
      Toast.show({
        type: 'error',
        text1: 'Conversa em família',
        text2: 'Preencha o título, a passagem e o objetivo para sugerir a conversa.',
      });
      return;
    }

    setSuggesting(true);

    try {
      const suggestion = await suggestClassLessonFamily({
        eventId,
        roomKey,
        roomLabel,
        title,
        biblePassage,
        mainObjective,
      });
      setFamilyExtension(suggestion);
      Toast.show({
        type: 'success',
        text1: 'Conversa em família',
        text2: 'Sugestão colocada no campo. Revise antes de salvar.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Conversa em família',
        text2: error instanceof Error ? error.message : 'Não foi possível sugerir a conversa.',
      });
    } finally {
      setSuggesting(false);
    }
  };

  const handleClear = () => {
    if (saving || suggesting || loading) {
      return;
    }

    setTitle('');
    setBiblePassage('');
    setMainObjective('');
    setResourcesNotes('');
    setFamilyExtension('');
    setFamilyCopied(false);
  };

  const handleCopyFamily = async () => {
    const text = familyExtension.trim();

    if (!text) {
      Toast.show({
        type: 'error',
        text1: 'Conversa em família',
        text2: 'Não há sugestão para copiar.',
      });
      return;
    }

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
    } catch {
      await Clipboard.setStringAsync(text);
    }

    setFamilyCopied(true);
  };

  const handleSave = async () => {
    if (saving || loading) {
      return;
    }

    setSaving(true);

    try {
      await saveClassLesson(eventId, roomKey, {
        title,
        bible_passage: biblePassage,
        main_objective: mainObjective,
        resources_notes: resourcesNotes,
        family_extension: familyExtension,
        class_date: getEventCalendarDate(eventDate) ?? '',
      });
      Toast.show({
        type: 'success',
        text1: 'Planejamento da aula',
        text2: 'Planejamento gravado.',
      });
      onClose();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Planejamento da aula',
        text2: error instanceof Error ? error.message : 'Não foi possível gravar.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>Planejamento da aula</Text>
          <Text style={styles.subtitle}>
            {roomLabel}
            {classDateLabel ? ` · ${classDateLabel}` : ''}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fields}>
            <Field label="Título ou tema central" value={title} onChangeText={setTitle} />
            <Field label="Passagem bíblica principal" value={biblePassage} onChangeText={setBiblePassage} />
            <Field
              label="O que as crianças devem levar no coração"
              value={mainObjective}
              onChangeText={setMainObjective}
              multiline
            />
            <Field
              label="Recursos, materiais ou dinâmicas"
              value={resourcesNotes}
              onChangeText={setResourcesNotes}
              multiline
            />
            <Text style={styles.section}>Conversa em família</Text>
            <Text style={styles.sectionHint}>
              Pergunta, desafio ou dica para os pais continuarem a conversa com a criança durante a semana.
            </Text>
            <Pressable
              onPress={() => void handleSuggestFamily()}
              disabled={suggesting}
              style={[styles.suggestButton, suggesting && styles.suggestButtonBusy]}
              accessibilityRole="button"
              accessibilityLabel="Sugerir conversa em família a partir do título, da passagem e do objetivo"
            >
              {suggesting ? (
                <ActivityIndicator color={MINIMAL_UI.onDark} />
              ) : (
                <Text style={styles.suggestButtonText}>Sugerir conversa em família</Text>
              )}
            </Pressable>
            <View style={styles.field}>
              <View style={styles.copyRow}>
                <Text style={styles.label}>Extensão para casa</Text>
                <Pressable
                  onPress={() => void handleCopyFamily()}
                  style={styles.copyButton}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar sugestão da conversa em família"
                >
                  <Text style={styles.copyButtonText}>{familyCopied ? 'Copiado' : 'Copiar'}</Text>
                </Pressable>
              </View>
              <TextInput
                value={familyExtension}
                onChangeText={(value) => {
                  setFamilyCopied(false);
                  setFamilyExtension(value);
                }}
                multiline
                style={[styles.input, styles.inputMultiline]}
                placeholderTextColor={MINIMAL_UI.textMuted}
              />
            </View>
            </View>
            <View
              style={[styles.saveWrap, (saving || suggesting) && styles.saveWrapBusy]}
              pointerEvents={saving || suggesting ? 'none' : 'auto'}
            >
              <View style={styles.saveInner}>
                <View style={styles.saveRow}>
                  <CloseButton
                    label="Limpar"
                    accessibilityLabel="Limpar todos os campos do planejamento"
                    variant="outline"
                    layout="flex"
                    onPress={handleClear}
                  />
                  <CloseButton
                    label="Salvar planejamento"
                    accessibilityLabel="Salvar planejamento da aula"
                    layout="flex"
                    onPress={() => void handleSave()}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        )}
        <CloseFooterBar onPress={onClose} accessibilityLabel="Fechar planejamento da aula" />
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={MINIMAL_UI.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  subtitle: {
    fontSize: 13,
    color: MINIMAL_UI.textMuted,
  },
  loader: {
    marginTop: 24,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
    gap: 12,
  },
  fields: {
    paddingHorizontal: 16,
    gap: 12,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: MINIMAL_UI.text,
  },
  input: {
    borderWidth: 0,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.rowHover,
    color: MINIMAL_UI.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  section: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.textMuted,
    marginTop: -6,
  },
  suggestButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: MINIMAL_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  suggestButtonBusy: {
    opacity: 0.7,
  },
  suggestButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '800',
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  copyButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: MINIMAL_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  copyButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 13,
    fontWeight: '800',
  },
  saveWrap: {
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
  },
  saveWrapBusy: {
    opacity: 0.6,
  },
  saveInner: {
    paddingHorizontal: 16,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
});
