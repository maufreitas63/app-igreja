import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { loadVerbumLesson, speakVerse, submitVerbumExercise } from '@/lib/verbum/api';
import type { FillBlankPayload, OrderWordsPayload, VerbumExercise, VerbumLearner } from '@/lib/verbum/types';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const NAVY = '#1E3A8A';

function isFillBlank(exercise: VerbumExercise): exercise is VerbumExercise & { payload: FillBlankPayload } {
  return exercise.exerciseType === 'FILL_BLANK';
}

export default function VerbumLessonScreen() {
  const params = useLocalSearchParams();
  const lessonId = Number(Array.isArray(params.lessonId) ? params.lessonId[0] : params.lessonId);
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [learner, setLearner] = useState<VerbumLearner | null>(null);
  const [queue, setQueue] = useState<VerbumExercise[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [built, setBuilt] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string; expected: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [checking, setChecking] = useState(false);
  const shake = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await loadVerbumLesson(lessonId);
        if (!active) {
          return;
        }
        setTitle(session.lesson.title);
        setSummary(session.lesson.theologicalSummary);
        setLearner(session.learner);
        setQueue(session.exercises);
        setTotal(session.exercises.length);
        setPaused(!session.learner.infiniteShields && session.learner.shields <= 0);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a lição.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [lessonId]);

  const current = queue[0] ?? null;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const pool = current && !isFillBlank(current)
    ? (current.payload as OrderWordsPayload).shuffled.filter((word) => {
        const used = built.filter((item) => item === word).length;
        const available = (current.payload as OrderWordsPayload).shuffled.filter((item) => item === word).length;
        return used < available;
      })
    : [];

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const verify = async () => {
    if (!current || checking || feedback) {
      return;
    }
    setChecking(true);
    try {
      const answer = isFillBlank(current)
        ? { choice: choice ?? '' }
        : { order: built };
      const result = await submitVerbumExercise(current.id, answer);
      setLearner((previous) =>
        previous
          ? {
              ...previous,
              shields: result.shields,
              infiniteShields: result.infiniteShields,
              talents: result.talents,
              streak: result.streak,
            }
          : previous
      );
      setFeedback({ correct: result.correct, message: result.message, expected: result.expectedLabel });
      setPaused(result.paused);
      if (!result.correct) {
        runShake();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível verificar.');
    } finally {
      setChecking(false);
    }
  };

  const continueLesson = () => {
    if (!current || !feedback) {
      return;
    }
    const rest = queue.slice(1);
    const nextQueue = feedback.correct ? rest : [...rest, current];
    setQueue(nextQueue);
    setDone((value) => value + (feedback.correct ? 1 : 0));
    setChoice(null);
    setBuilt([]);
    setFeedback(null);
    if (feedback.correct && rest.length === 0) {
      setFinished(true);
    }
  };

  const shieldLabel = learner?.infiniteShields ? '∞' : String(learner?.shields ?? 0);

  return (
    <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.shields}>Escudos {shieldLabel}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
        </View>
        {loading ? <ActivityIndicator color={NAVY} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {finished ? (
          <View style={styles.card}>
            <Text style={styles.prompt}>Lição concluída</Text>
            <Text style={styles.verse}>{summary}</Text>
          </View>
        ) : null}
        {paused && !finished ? (
          <Text style={styles.error}>
            Os Escudos de Fé acabaram. Volte ao Verbum e pratique no Altar de Memoriais, ou aguarde a regeneração.
          </Text>
        ) : null}
        {current && !finished && !paused ? (
          <Animated.View style={[styles.card, { transform: [{ translateX: shake }] }]}>
            <Text style={styles.prompt}>{current.prompt}</Text>
            {current.passageRef ? <Text style={styles.ref}>{current.passageRef}</Text> : null}
            <Text style={styles.verse}>{current.versePt}</Text>
            <Pressable
              onPress={() => speakVerse(current.verseEn, current.audioUrl)}
              accessibilityRole="button"
            >
              <Text style={styles.listen}>Ouvir versículo</Text>
            </Pressable>
            {isFillBlank(current) ? (
              <>
                <Text style={styles.sentence}>{current.payload.sentence}</Text>
                {current.payload.options.map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.option, choice === option && styles.optionOn]}
                    onPress={() => setChoice(option)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.optionLabel}>{option}</Text>
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.sentence}>{built.join(' ') || 'Toque as palavras na ordem.'}</Text>
                <View style={styles.words}>
                  {pool.map((word, index) => (
                    <Pressable
                      key={`${word}-${index}`}
                      style={styles.word}
                      onPress={() => setBuilt((value) => [...value, word])}
                      accessibilityRole="button"
                    >
                      <Text style={styles.optionLabel}>{word}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </Animated.View>
        ) : null}
        {feedback ? (
          <View style={[styles.feedback, feedback.correct ? styles.ok : styles.bad]}>
            <Text style={styles.feedbackText}>{feedback.message}</Text>
            {!feedback.correct && feedback.expected ? (
              <Text style={styles.feedbackText}>{feedback.expected}</Text>
            ) : null}
          </View>
        ) : null}
        {current && !finished && !paused ? (
          <Pressable
            style={styles.verify}
            onPress={() => void (feedback ? continueLesson() : verify())}
            accessibilityRole="button"
          >
            <Text style={styles.verifyLabel}>{feedback ? 'Continuar' : 'Verificar'}</Text>
          </Pressable>
        ) : null}
        {!loading && !current && !finished && !error ? (
          <Text style={styles.verse}>{title}</Text>
        ) : null}
        {title && !finished ? <Text style={styles.lessonTitle}>{title}</Text> : null}
      </ScrollView>
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
    gap: 12,
  },
  header: {
    gap: 8,
  },
  shields: {
    color: NAVY,
    fontWeight: '800',
    textAlign: 'right',
  },
  track: {
    height: 10,
    borderRadius: 8,
    backgroundColor: '#E4DECF',
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    backgroundColor: '#0F766E',
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#F7F6EF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  prompt: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '800',
  },
  ref: {
    color: '#3B4F93',
    fontWeight: '700',
  },
  verse: {
    color: '#24315C',
    lineHeight: 22,
  },
  listen: {
    color: '#2F6FED',
    fontWeight: '800',
  },
  sentence: {
    color: '#24315C',
    fontSize: 18,
    fontWeight: '700',
  },
  option: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4DECF',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionOn: {
    borderColor: '#2F6FED',
    backgroundColor: '#D6E6F8',
  },
  optionLabel: {
    color: '#24315C',
    fontWeight: '700',
    textAlign: 'center',
  },
  words: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  word: {
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D3E2F4',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  feedback: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  ok: {
    backgroundColor: '#D1FAE5',
  },
  bad: {
    backgroundColor: '#FEE2E2',
  },
  feedbackText: {
    color: '#24315C',
    fontWeight: '700',
    textAlign: 'center',
  },
  verify: {
    backgroundColor: '#2F6FED',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  lessonTitle: {
    color: '#4B5568',
    textAlign: 'center',
  },
});
