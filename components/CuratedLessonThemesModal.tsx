import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { listCuratedLessonThemes } from '@/lib/curatedLessonThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { LESSON_CATEGORIES, type LessonCategory } from '@/types/class-lesson';
import type { CuratedLessonTheme } from '@/types/lesson-theme';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onInclude: (theme: CuratedLessonTheme) => Promise<void>;
};

export function CuratedLessonThemesModal({ visible, onClose, onInclude }: Props) {
  const [themes, setThemes] = useState<CuratedLessonTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<LessonCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [including, setIncluding] = useState(false);
  const [includeError, setIncludeError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setCategory(null);
      setSelectedId(null);
      setIncluding(false);
      setIncludeError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listCuratedLessonThemes()
      .then((rows) => {
        if (!cancelled) {
          setThemes(rows);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setThemes([]);
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os temas.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const categoryInfo = LESSON_CATEGORIES.find((item) => item.code === category) ?? null;
  const filtered = useMemo(
    () => (category ? themes.filter((theme) => theme.category === category) : []),
    [category, themes]
  );
  const selected = filtered.find((theme) => theme.id === selectedId) ?? null;

  const goBack = () => {
    if (including) {
      return;
    }
    setIncludeError(null);
    if (selected) {
      setSelectedId(null);
      return;
    }
    setCategory(null);
  };

  const handleInclude = async () => {
    if (!selected || including) {
      return;
    }

    setIncluding(true);
    setIncludeError(null);

    try {
      await onInclude(selected);
      onClose();
    } catch (includeFailure: unknown) {
      setIncludeError(
        includeFailure instanceof Error ? includeFailure.message : 'Não foi possível incluir o tema no planejamento.'
      );
    } finally {
      setIncluding(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>Temas da aula</Text>
          <Text style={styles.subtitle}>
            {categoryInfo
              ? categoryInfo.title
              : 'Escolha o eixo temático para ver os temas pré-cadastrados.'}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {selected ? (
              <ThemeDetail theme={selected} />
            ) : category ? (
              filtered.length === 0 ? (
                <Text style={styles.empty}>Nenhum tema cadastrado nesta categoria.</Text>
              ) : (
                filtered.map((theme) => (
                  <Pressable
                    key={theme.id}
                    onPress={() => setSelectedId(theme.id)}
                    style={styles.card}
                    accessibilityRole="button"
                    accessibilityLabel={theme.title}
                  >
                    <Text style={styles.cardTitle}>{theme.title}</Text>
                    <Text style={styles.cardMeta}>{theme.bible_passage}</Text>
                  </Pressable>
                ))
              )
            ) : (
              LESSON_CATEGORIES.map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => setCategory(item.code)}
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.description}`}
                >
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>{item.description}</Text>
                </Pressable>
              ))
            )}
            {selected ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleInclude()}
                  disabled={including}
                  style={[styles.include, including && styles.includeBusy]}
                  accessibilityRole="button"
                  accessibilityLabel="Incluir no Planejamento"
                >
                  {including ? (
                    <ActivityIndicator color={MINIMAL_UI.onDark} />
                  ) : (
                    <Text style={styles.includeText}>Incluir no Planejamento</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={goBack}
                  disabled={including}
                  style={styles.back}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar aos temas"
                >
                  <Text style={styles.backText}>Voltar aos temas</Text>
                </Pressable>
              </View>
            ) : category ? (
              <Pressable
                onPress={goBack}
                style={styles.back}
                accessibilityRole="button"
                accessibilityLabel="Voltar às categorias"
              >
                <Text style={styles.backText}>Voltar às categorias</Text>
              </Pressable>
            ) : null}
            {includeError ? <Text style={styles.includeError}>{includeError}</Text> : null}
          </ScrollView>
        )}
        <CloseFooterBar onPress={onClose} accessibilityLabel="Fechar temas da aula" />
      </SafeAreaView>
    </Modal>
  );
}

function ThemeDetail({ theme }: { theme: CuratedLessonTheme }) {
  return (
    <View style={styles.detail}>
      <Detail label="Título" value={theme.title} />
      <Detail label="Referência bíblica" value={theme.bible_passage} />
      <Detail label="O que levar no coração" value={theme.core_lesson} />
      <Detail label="Sugestão de dinâmica" value={theme.activity_suggestion} />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
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
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.textMuted,
  },
  loader: {
    marginTop: 24,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  cardMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.text,
  },
  empty: {
    paddingHorizontal: 16,
    fontSize: 14,
    lineHeight: 20,
    color: MINIMAL_UI.textMuted,
  },
  detail: {
    gap: 14,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MINIMAL_UI.textMuted,
  },
  fieldValue: {
    fontSize: 15,
    lineHeight: 21,
    color: MINIMAL_UI.text,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  include: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  includeBusy: {
    opacity: 0.7,
  },
  includeText: {
    fontSize: 14,
    fontWeight: '800',
    color: MINIMAL_UI.onDark,
    textAlign: 'center',
  },
  includeError: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.text,
  },
  back: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '800',
    color: MINIMAL_UI.accent,
  },
});
