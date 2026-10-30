import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam, withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { loadVerbumCourse, restoreVerbumShield } from '@/lib/verbum/api';
import type { VerbumCourseHome } from '@/lib/verbum/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const NAVY = '#1E3A8A';

export default function VerbumScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<VerbumCourseHome | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourse(await loadVerbumCourse());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o Verbum.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openLesson = () => {
    if (!course?.lesson) {
      return;
    }
    router.push({
      pathname: '/verbum-licao',
      params: withReturnRoute('/verbum', { lessonId: String(course.lesson.id) }),
    });
  };

  const practiceMemorial = async () => {
    try {
      const learner = await restoreVerbumShield();
      setCourse((current) => (current ? { ...current, learner } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar o escudo.');
    }
  };

  const shieldsLabel = course?.learner.infiniteShields
    ? 'Escudos infinitos'
    : `${course?.learner.shields ?? 0} Escudos de Fé`;

  return (
    <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Verbum</Text>
        <Text style={styles.subtitle}>Inglês de Gênesis ao Apocalipse</Text>
        {loading ? <ActivityIndicator color={NAVY} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {course ? (
          <>
            <View style={styles.stats}>
              <Text style={styles.stat}>Lâmpada acesa: {course.learner.streak}</Text>
              <Text style={styles.stat}>{shieldsLabel}</Text>
              <Text style={styles.stat}>{course.learner.talents} Talentos</Text>
            </View>
            {course.lesson ? (
              <Pressable style={styles.start} onPress={openLesson} accessibilityRole="button">
                <Text style={styles.startLabel}>Começar lição</Text>
                <Text style={styles.startHint}>{course.lesson.title}</Text>
              </Pressable>
            ) : null}
            {course.learner.shields <= 0 && !course.learner.infiniteShields ? (
              <View style={styles.pause}>
                <Text style={styles.pauseTitle}>Escudos esgotados</Text>
                <Text style={styles.pauseBody}>
                  Aguarde 30 minutos para regenerar um escudo, pratique no Altar de Memoriais ou assine o Verbum Fidelis.
                </Text>
                <Pressable style={styles.secondary} onPress={() => void practiceMemorial()} accessibilityRole="button">
                  <Text style={styles.secondaryLabel}>
                    Altar de Memoriais ({course.memorialsDue} para restaurar)
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.section}>Cânon</Text>
            {course.books.map((book) => (
              <View key={book.orderIndex} style={styles.book}>
                <Text style={styles.bookName}>
                  {book.orderIndex}. {book.namePt}
                </Text>
                <Text style={styles.bookMeta}>
                  {book.nameEn} · {book.cefr}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
    gap: 10,
  },
  title: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#3B4F93',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  stats: {
    gap: 4,
    marginBottom: 8,
  },
  stat: {
    color: '#24315C',
    fontSize: 15,
    textAlign: 'center',
  },
  start: {
    backgroundColor: '#2F6FED',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  startLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  startHint: {
    color: '#E8F1FB',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  pause: {
    backgroundColor: '#F7F6EF',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  pauseTitle: {
    color: NAVY,
    fontWeight: '800',
    textAlign: 'center',
  },
  pauseBody: {
    color: '#24315C',
    textAlign: 'center',
    lineHeight: 20,
  },
  secondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8FB4E0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryLabel: {
    color: NAVY,
    fontWeight: '700',
    textAlign: 'center',
  },
  section: {
    marginTop: 12,
    color: NAVY,
    fontSize: 18,
    fontWeight: '800',
  },
  book: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4DECF',
  },
  bookName: {
    color: '#24315C',
    fontSize: 16,
    fontWeight: '700',
  },
  bookMeta: {
    color: '#4B5568',
    fontSize: 13,
  },
});
