import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { resolveReturnRouteParam, withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { loadVerbumCourse } from '@/lib/verbum/api';
import type { VerbumCourseHome } from '@/lib/verbum/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const NAVY = '#1E3A8A';
const LOCK_MESSAGE = 'Complete as lições anteriores para desbloquear!';

export default function VerbumCanonScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const returnRoute = resolveReturnRouteParam(params) || '/escolha-plataforma';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<VerbumCourseHome | null>(null);
  const [openBook, setOpenBook] = useState<number | null>(null);
  const [lockedId, setLockedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const home = await loadVerbumCourse();
      setCourse(home);
      setOpenBook(home.books.find((book) => book.lessons.some((lesson) => lesson.status !== 'locked'))?.orderIndex ?? 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o cânon.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const backToPath = () => {
    router.replace({
      pathname: '/verbum',
      params: withReturnRoute(returnRoute),
    });
  };

  return (
    <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={backToPath} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Cânon</Text>
        <Text style={styles.subtitle}>Os 66 livros, para consulta. O estudo diário fica na trilha.</Text>
        {loading ? <ActivityIndicator color={NAVY} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {course?.books.map((book) => {
          const opened = openBook === book.orderIndex;
          return (
            <View key={book.orderIndex} style={[styles.book, opened ? styles.bookOpen : null]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpenBook(opened ? null : book.orderIndex)}
                style={styles.bookHead}
              >
                <View style={styles.bookText}>
                  <Text style={styles.bookName}>
                    {book.orderIndex}. {book.namePt}
                  </Text>
                  <Text style={styles.bookMeta}>
                    {book.nameEn} · {book.cefr}
                    {book.lessons.length > 0 ? ` · ${book.lessons.length} lições` : ''}
                  </Text>
                </View>
                <Text style={styles.bookAction}>{opened ? 'Recolher' : 'Abrir'}</Text>
              </Pressable>
              {opened ? (
                book.lessons.length > 0 ? (
                  book.lessons.map((lesson) => (
                    <View key={lesson.id}>
                      <Pressable
                        accessibilityRole="button"
                        style={[styles.lesson, lesson.status === 'locked' ? styles.lessonLocked : null]}
                        onPress={() => {
                          if (lesson.status === 'locked') {
                            setLockedId(lesson.id);
                            return;
                          }
                          router.push({
                            pathname: '/verbum-licao',
                            params: withReturnRoute('/verbum', { lessonId: String(lesson.id) }),
                          });
                        }}
                      >
                        <Text style={[styles.lessonTitle, lesson.status === 'locked' ? styles.lessonTitleLocked : null]}>
                          {lesson.title}
                        </Text>
                        <Text style={styles.lessonMeta}>
                          {lesson.status === 'done'
                            ? 'Concluída · rever'
                            : lesson.status === 'current'
                              ? 'Lição atual'
                              : 'Bloqueada'}
                        </Text>
                      </Pressable>
                      {lockedId === lesson.id ? <Text style={styles.lockNote}>{LOCK_MESSAGE}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyBook}>As lições deste livro ainda não foram escritas.</Text>
                )
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
    gap: 8,
  },
  title: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#3B4F93',
    textAlign: 'center',
    marginBottom: 8,
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  book: {
    borderBottomWidth: 1,
    borderBottomColor: '#E4DECF',
    borderRadius: 12,
  },
  bookOpen: {
    backgroundColor: '#D6E6F8',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  bookHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  bookText: {
    flex: 1,
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
  bookAction: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  lesson: {
    backgroundColor: '#2F6FED',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  lessonLocked: {
    backgroundColor: '#E2E8F0',
  },
  lessonTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  lessonTitleLocked: {
    color: '#475569',
  },
  lessonMeta: {
    color: '#E8F1FB',
    fontSize: 12,
    marginTop: 2,
  },
  emptyBook: {
    color: '#24315C',
    fontSize: 14,
    paddingBottom: 8,
  },
  lockNote: {
    color: '#9F1239',
    marginTop: 6,
    fontWeight: '700',
  },
});
