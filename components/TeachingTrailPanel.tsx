import { LessonDetailModal } from '@/components/LessonDetailModal';
import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import { listClassLessonTrail } from '@/lib/classLessonApi';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ClassLessonDetail, ClassRoomKey } from '@/types/class-lesson';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const formatClassDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

export function TeachingTrailPanel() {
  const { kidsRoomLabel, teensRoomLabel } = useRoomDisplayLabels();
  const [roomKey, setRoomKey] = useState<ClassRoomKey>('KIDS');
  const [lessons, setLessons] = useState<ClassLessonDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClassLessonDetail | null>(null);

  const roomLabel = roomKey === 'TEENS' ? teensRoomLabel : kidsRoomLabel;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const rows = await listClassLessonTrail(roomKey);
        if (!cancelled) {
          setLessons(rows);
        }
      } catch (loadError) {
        if (!cancelled) {
          setLessons([]);
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a trilha.');
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
  }, [roomKey]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Trilha de ensino</Text>
      <View style={styles.filters}>
        <FilterButton
          label={kidsRoomLabel || 'Sala Infantil'}
          selected={roomKey === 'KIDS'}
          onPress={() => setRoomKey('KIDS')}
        />
        <FilterButton
          label={teensRoomLabel || 'Sala Jovens'}
          selected={roomKey === 'TEENS'}
          onPress={() => setRoomKey('TEENS')}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : lessons.length === 0 ? (
        <Text style={styles.empty}>Nenhuma aula registrada nesta sala.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {lessons.map((lesson) => (
            <Pressable
              key={lesson.id}
              style={styles.row}
              onPress={() => setSelected(lesson)}
              accessibilityRole="button"
              accessibilityLabel={`${formatClassDate(lesson.classDate)}. ${lesson.title}`}
            >
              <Text style={styles.date}>{formatClassDate(lesson.classDate)}</Text>
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <LessonDetailModal
        lesson={selected}
        roomLabel={roomLabel}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function FilterButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filter, selected && styles.filterSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    backgroundColor: MINIMAL_UI.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filter: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: MINIMAL_UI.rowHover,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  filterSelected: {
    backgroundColor: MINIMAL_UI.accent,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  filterTextSelected: {
    color: MINIMAL_UI.onDark,
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    color: MINIMAL_UI.textMuted,
  },
  list: {
    gap: 8,
    paddingBottom: 24,
  },
  row: {
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  date: {
    fontSize: 13,
    fontWeight: '800',
    color: MINIMAL_UI.accent,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: MINIMAL_UI.text,
  },
});
