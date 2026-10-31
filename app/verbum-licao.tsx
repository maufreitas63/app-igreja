import { AgnusMascot, type AgnusReaction } from '@/components/verbum/AgnusMascot';
import { ExerciseSpeakingVerse } from '@/components/verbum/ExerciseSpeakingVerse';
import { WordToken } from '@/components/verbum/WordToken';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam, withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { finishVerbumLesson, loadVerbumLesson, speakVerse, submitVerbumExercise } from '@/lib/verbum/api';
import { playCorrectChime, playWrongTone } from '@/lib/verbum/sound';
import type { FillBlankPayload, MatchPair, MatchPairsPayload, OrderWordsPayload, SpeakingVersePayload, VerbumExercise, VerbumLearner, VerbumLessonRef } from '@/lib/verbum/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function isFillBlank(exercise: VerbumExercise): exercise is VerbumExercise & { payload: FillBlankPayload } {
  return exercise.exerciseType === 'FILL_BLANK';
}

function isMatch(exercise: VerbumExercise): exercise is VerbumExercise & { payload: MatchPairsPayload } {
  return exercise.exerciseType === 'MATCH_PAIRS';
}

function isSpeaking(exercise: VerbumExercise): exercise is VerbumExercise & { payload: SpeakingVersePayload } {
  return exercise.exerciseType === 'SPEAKING_VERSE';
}

function isOrder(exercise: VerbumExercise): exercise is VerbumExercise & { payload: OrderWordsPayload } {
  return exercise.exerciseType === 'ORDER_WORDS' || exercise.exerciseType === 'LISTENING_DICTATION';
}

function dynamicKey(exercise: VerbumExercise): string {
  return isOrder(exercise) ? 'ORDER_WORDS' : exercise.exerciseType;
}

function firstOfEachDynamic(exercises: VerbumExercise[]): VerbumExercise[] {
  const seen = new Set<string>();
  return exercises.filter((exercise) => {
    const key = dynamicKey(exercise);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function remainingOrderWords(shuffled: readonly string[], built: readonly string[]): string[] {
  const left = new Map<string, number>();
  for (const word of shuffled) {
    left.set(word, (left.get(word) ?? 0) + 1);
  }
  for (const word of built) {
    const count = left.get(word) ?? 0;
    if (count > 0) {
      left.set(word, count - 1);
    }
  }
  const shown = new Map<string, number>();
  return shuffled.filter((word) => {
    const allowed = left.get(word) ?? 0;
    const kept = shown.get(word) ?? 0;
    if (kept >= allowed) {
      return false;
    }
    shown.set(word, kept + 1);
    return true;
  });
}

export default function VerbumLessonScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
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
  const [matches, setMatches] = useState<MatchPair[]>([]);
  const [speakingGate, setSpeakingGate] = useState<'pass' | 'retry' | null>(null);
  const [speakingTranscript, setSpeakingTranscript] = useState('');
  const [speakingTry, setSpeakingTry] = useState(0);
  const [pickEn, setPickEn] = useState<string | null>(null);
  const [unitCrown, setUnitCrown] = useState(false);
  const [crownTalents, setCrownTalents] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string; expected: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [nextLesson, setNextLesson] = useState<VerbumLessonRef | null>(null);
  const [checking, setChecking] = useState(false);
  const shake = useMemo(() => new Animated.Value(0), []);
  const slide = useMemo(() => new Animated.Value(0), []);
  const shieldScale = useMemo(() => new Animated.Value(1), []);
  const previousShields = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setFinished(false);
    setNextLesson(null);
    setFeedback(null);
    setChoice(null);
    setBuilt([]);
    setMatches([]);
    setPickEn(null);
    setSpeakingGate(null);
    setSpeakingTranscript('');
    setSpeakingTry(0);
    setUnitCrown(false);
    setCrownTalents(0);
    setDone(0);
    setLoading(true);
    void (async () => {
      try {
        const session = await loadVerbumLesson(lessonId);
        if (!active) {
          return;
        }
        const exercises = firstOfEachDynamic(session.exercises);
        setTitle(session.lesson.title);
        setSummary(session.lesson.theologicalSummary);
        setLearner(session.learner);
        setQueue(exercises);
        setTotal(exercises.length);
        setPaused(!session.learner.infiniteShields && session.learner.shields <= 0);
        previousShields.current = session.learner.shields;
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
  const speakingPhrase = current && isSpeaking(current)
    ? current.payload.targetPhrase || current.verseEn
    : current?.verseEn ?? '';

  useEffect(() => {
    slide.setValue(48);
    Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, [current?.id, slide]);

  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const orderPayload = current && isOrder(current) ? current.payload : null;
  const pool = orderPayload ? remainingOrderWords(orderPayload.shuffled, built) : [];
  const canVerify = current
    ? isFillBlank(current)
      ? Boolean(choice)
      : isMatch(current)
        ? matches.length === current.payload.pairs.length && current.payload.pairs.length > 0
        : built.length === (orderPayload?.answer.length ?? 0) && (orderPayload?.answer.length ?? 0) > 0
    : false;

  const reaction: AgnusReaction = speakingGate === 'pass'
    ? 'CELEBRATING'
    : speakingGate === 'retry'
      ? 'CONSOLING'
      : finished
        ? unitCrown
          ? 'CELEBRATING'
          : 'STREAK_FIRE'
        : feedback?.correct
          ? 'CELEBRATING'
          : feedback
            ? 'CONSOLING'
            : 'THINKING';

  const pulseShield = () => {
    shieldScale.setValue(1);
    Animated.sequence([
      Animated.timing(shieldScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(shieldScale, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const verify = async () => {
    if (!current || checking || feedback || !canVerify) {
      return;
    }
    setChecking(true);
    try {
      const answer = isFillBlank(current)
        ? { choice: choice ?? '' }
        : isMatch(current)
          ? { matches }
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
      if (
        previousShields.current != null
        && result.shields < previousShields.current
        && !result.infiniteShields
      ) {
        pulseShield();
      }
      previousShields.current = result.shields;
      setFeedback({ correct: result.correct, message: result.message, expected: result.expectedLabel });
      setPaused(result.paused);
      if (result.correct) {
        playCorrectChime();
      } else {
        playWrongTone();
        runShake();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível verificar.');
    } finally {
      setChecking(false);
    }
  };

  const advanceAfterSpeaking = async () => {
    if (!current || checking || !isSpeaking(current) || speakingGate !== 'pass') {
      return;
    }
    setChecking(true);
    try {
      const result = await submitVerbumExercise(current.id, { transcript: speakingTranscript });
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
      previousShields.current = result.shields;
      if (!result.correct) {
        setSpeakingGate('retry');
        playWrongTone();
        runShake();
        return;
      }
      const rest = queue.slice(1);
      setQueue(rest);
      setDone((value) => value + 1);
      setSpeakingGate(null);
      setSpeakingTranscript('');
      setChoice(null);
      setBuilt([]);
      setMatches([]);
      setPickEn(null);
      setPaused(result.paused);
      if (rest.length === 0) {
        setFinished(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a pronúncia.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!finished) {
      return undefined;
    }
    let active = true;
    void finishVerbumLesson(lessonId)
      .then((result) => {
        if (active) {
          setNextLesson(result.lesson);
          setUnitCrown(result.unitCrown);
          setCrownTalents(result.talentsAwarded);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a próxima lição.');
        }
      });
    return () => {
      active = false;
    };
  }, [finished, lessonId]);

  const openCourse = () => {
    router.replace({
      pathname: '/verbum',
      params: withReturnRoute('/escolha-plataforma'),
    });
  };

  const continueCourse = () => {
    if (!nextLesson) {
      openCourse();
      return;
    }
    router.replace({
      pathname: '/verbum-licao',
      params: withReturnRoute('/verbum', { lessonId: String(nextLesson.id) }),
    });
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
    setMatches([]);
    setPickEn(null);
    setSpeakingGate(null);
    setSpeakingTranscript('');
    setFeedback(null);
    if (feedback.correct && rest.length === 0) {
      setFinished(true);
    }
  };

  const skipExercise = () => {
    if (!current || checking || finished) {
      return;
    }
    const rest = queue.slice(1);
    setQueue(rest);
    setDone((value) => value + 1);
    setChoice(null);
    setBuilt([]);
    setMatches([]);
    setPickEn(null);
    setSpeakingGate(null);
    setSpeakingTranscript('');
    setFeedback(null);
    if (rest.length === 0) {
      setFinished(true);
    }
  };

  const speakingNow = Boolean(current && isSpeaking(current) && !finished && !feedback);
  const buttonTone = feedback?.correct || finished || speakingGate === 'pass'
    ? styles.buttonOk
    : feedback || speakingGate === 'retry'
      ? styles.buttonBad
      : canVerify
        ? styles.buttonOk
        : styles.buttonOff;
  const buttonLabel = finished
    ? 'CONTINUAR'
    : feedback
      ? feedback.correct
        ? 'CONTINUAR'
        : 'ENTENDIDO'
      : speakingNow
        ? speakingGate === 'retry'
          ? 'TENTAR NOVAMENTE'
          : 'CONTINUAR'
        : 'VERIFICAR';
  const showSkip = speakingNow && speakingGate === 'retry' && !finished;

  const actionButton = (
    <Pressable
      style={[styles.action, showSkip ? styles.actionGrow : null, buttonTone]}
      disabled={checking || (!finished && !feedback && !canVerify && !(speakingNow && speakingGate))}
      onPress={() => {
        if (finished) {
          continueCourse();
          return;
        }
        if (feedback) {
          continueLesson();
          return;
        }
        if (speakingNow && speakingGate === 'retry') {
          setSpeakingTry((value) => value + 1);
          setSpeakingGate(null);
          setSpeakingTranscript('');
          return;
        }
        if (speakingNow && speakingGate === 'pass') {
          void advanceAfterSpeaking();
          return;
        }
        void verify();
      }}
      accessibilityRole="button"
    >
      <Text style={[styles.actionLabel, !finished && !feedback && !canVerify && !(speakingNow && speakingGate) ? styles.actionLabelOff : null]}>
        {buttonLabel}
      </Text>
    </Pressable>
  );

  return (
    <MinimalScreenLayout
      scroll={false}
      footer={<CloseFooterBar onPress={finished ? openCourse : returnToCaller} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Animated.View style={{ transform: [{ scale: shieldScale }] }}>
            <Text style={[styles.shields, learner?.infiniteShields ? styles.shieldsGold : null]}>
              {learner?.infiniteShields ? 'Escudo infinito' : `Escudos ${learner?.shields ?? 0}`}
            </Text>
          </Animated.View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]}>
              <View style={styles.shine} />
            </View>
          </View>
        </View>
        {loading ? <ActivityIndicator color="#1E3A8A" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AgnusMascot
          reaction={reaction}
          lineEn={
            speakingGate === 'retry'
              ? 'Almost! Speak a little more slowly.'
              : finished && unitCrown
                ? 'The crown is yours.'
                : undefined
          }
          linePt={
            speakingGate === 'retry'
              ? 'Quase lá! Tente falar um pouco mais devagar.'
              : finished && unitCrown
                ? 'A coroa da unidade é sua.'
                : undefined
          }
        />
        {finished ? (
          <View style={styles.card}>
            <Text style={styles.prompt}>{unitCrown ? 'Coroa da unidade' : 'Lição concluída'}</Text>
            <Text style={styles.verse}>
              {unitCrown
                ? `A unidade está completa. ${crownTalents} Talentos e a coroa de ouro foram concedidos.`
                : summary}
            </Text>
            <Text style={styles.nextHint}>{nextLesson ? nextLesson.title : 'Voltar à trilha do curso'}</Text>
          </View>
        ) : null}
        {paused && !finished ? (
          <Text style={styles.error}>
            Os Escudos de Fé acabaram. Volte ao Verbum e pratique no Altar de Memoriais, ou aguarde a regeneração.
          </Text>
        ) : null}
        {current && !finished && !paused ? (
          <Animated.View style={[styles.card, { transform: [{ translateX: shake }, { translateX: slide }] }]}>
            <Text style={styles.prompt}>{current.prompt}</Text>
            {current.passageRef ? <Text style={styles.ref}>{current.passageRef}</Text> : null}
            <Text style={styles.verse}>{current.versePt}</Text>
            <View style={styles.listenRow}>
              <Pressable onPress={() => speakVerse(speakingPhrase, current.audioUrl)} accessibilityRole="button">
                <Text style={styles.listen}>Ouvir versículo</Text>
              </Pressable>
              <Pressable
                onPress={() => speakVerse(speakingPhrase, isSpeaking(current) ? null : current.audioUrl, 0.65)}
                accessibilityRole="button"
              >
                <Text style={styles.listen}>Ouvir devagar</Text>
              </Pressable>
            </View>
            {isFillBlank(current) ? (
              <FillBlankExercise
                sentence={current.payload.sentence}
                options={current.payload.options}
                choice={choice}
                onChoose={setChoice}
              />
            ) : isMatch(current) ? (
              <MatchPairsExercise
                pairs={current.payload.pairs}
                matches={matches}
                pickEn={pickEn}
                onPickEn={setPickEn}
                onMatch={(pair) => {
                  setMatches((value) => [...value, pair]);
                  setPickEn(null);
                }}
                onUndo={(en) => setMatches((value) => value.filter((pair) => pair.en !== en))}
              />
            ) : isSpeaking(current) ? (
              <ExerciseSpeakingVerse
                key={`${current.id}-${speakingTry}`}
                phrase={speakingPhrase}
                onPass={(transcript) => {
                  setSpeakingTranscript(transcript);
                  setSpeakingGate('pass');
                }}
                onMiss={() => {
                  setSpeakingGate('retry');
                  runShake();
                }}
              />
            ) : (
              <OrderWordsExercise
                built={built}
                pool={pool}
                onAdd={(word) => setBuilt((value) => [...value, word])}
                onRemove={(index) => setBuilt((value) => value.filter((_, item) => item !== index))}
              />
            )}
          </Animated.View>
        ) : null}
        {feedback && !finished ? (
          <View style={[styles.impact, feedback.correct ? styles.impactOk : styles.impactBad]}>
            <Text style={styles.impactTitle}>{feedback.correct ? 'Excelente!' : 'Solução correta:'}</Text>
            <Text style={styles.impactBody}>{feedback.correct ? feedback.message : feedback.expected}</Text>
          </View>
        ) : null}
        {(current && !paused) || finished ? (
          showSkip ? (
            <View style={styles.actionRow}>
              {actionButton}
              <Pressable
                style={[styles.action, styles.skip]}
                onPress={skipExercise}
                accessibilityRole="button"
                accessibilityLabel="Pular exercício"
              >
                <Text style={styles.skipLabel}>PULAR</Text>
              </Pressable>
            </View>
          ) : actionButton
        ) : null}
        {title && !finished ? <Text style={styles.lessonTitle}>{title}</Text> : null}
      </ScrollView>
    </MinimalScreenLayout>
  );
}

function shuffleCopy<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const item = next[index];
    next[index] = next[swap];
    next[swap] = item;
  }
  return next;
}

function lineOrder(items: readonly MatchPair[], field: 'en' | 'pt'): string {
  return items.map((item) => item[field]).join('\u0000');
}

function shuffledLine(pairs: readonly MatchPair[], field: 'en' | 'pt'): MatchPair[] {
  if (pairs.length < 2) {
    return [...pairs];
  }
  const original = lineOrder(pairs, field);
  let next = shuffleCopy(pairs);
  for (let attempt = 0; attempt < 8 && lineOrder(next, field) === original; attempt += 1) {
    next = shuffleCopy(pairs);
  }
  if (lineOrder(next, field) === original) {
    const [first, second, ...rest] = next;
    return [second, first, ...rest];
  }
  return next;
}

function samePairing(english: readonly MatchPair[], portuguese: readonly MatchPair[]): boolean {
  return english.length === portuguese.length
    && english.every((pair, index) => pair.en === portuguese[index]?.en);
}

function MatchPairsExercise({
  pairs,
  matches,
  pickEn,
  onPickEn,
  onMatch,
  onUndo,
}: {
  pairs: MatchPair[];
  matches: MatchPair[];
  pickEn: string | null;
  onPickEn: (value: string | null) => void;
  onMatch: (pair: MatchPair) => void;
  onUndo: (en: string) => void;
}) {
  const pairKey = pairs.map((pair) => `${pair.en}\u0000${pair.pt}`).join('\n');
  const orders = useMemo(() => {
    const english = shuffledLine(pairs, 'en');
    let portuguese = shuffledLine(pairs, 'pt');
    for (let attempt = 0; attempt < 8 && samePairing(english, portuguese); attempt += 1) {
      portuguese = shuffledLine(pairs, 'pt');
    }
    if (samePairing(english, portuguese) && portuguese.length > 1) {
      const [first, second, ...rest] = portuguese;
      portuguese = [second, first, ...rest];
    }
    return { english, portuguese };
  }, [pairKey]);
  const usedEn = new Set(matches.map((pair) => pair.en));
  const usedPt = new Set(matches.map((pair) => pair.pt));
  return (
    <View style={styles.block}>
      <View style={styles.bank}>
        {matches.map((pair) => (
          <WordToken key={pair.en} label={`${pair.en} = ${pair.pt}`} placed onPress={() => onUndo(pair.en)} />
        ))}
      </View>
      <View style={styles.bank}>
        {orders.english.filter((pair) => !usedEn.has(pair.en)).map((pair) => (
          <WordToken
            key={pair.en}
            label={pair.en}
            placed={pickEn === pair.en}
            onPress={() => onPickEn(pickEn === pair.en ? null : pair.en)}
          />
        ))}
      </View>
      <View style={styles.bank}>
        {orders.portuguese.filter((pair) => !usedPt.has(pair.pt)).map((pair) => (
          <WordToken
            key={pair.pt}
            label={pair.pt}
            onPress={() => {
              if (!pickEn) {
                return;
              }
              onMatch({ en: pickEn, pt: pair.pt });
            }}
          />
        ))}
      </View>
    </View>
  );
}

function FillBlankExercise({
  sentence,
  options,
  choice,
  onChoose,
}: {
  sentence: string;
  options: string[];
  choice: string | null;
  onChoose: (value: string | null) => void;
}) {
  const [before, after] = sentence.split('_____');
  return (
    <View style={styles.block}>
      <View style={styles.answerLine}>
        <Text style={styles.sentence}>{before}</Text>
        {choice ? (
          <WordToken label={choice} placed onPress={() => onChoose(null)} />
        ) : (
          <View style={styles.slot} />
        )}
        <Text style={styles.sentence}>{after}</Text>
      </View>
      <View style={styles.bank}>
        {options.filter((option) => option !== choice).map((option) => (
          <WordToken key={option} label={option} onPress={() => onChoose(option)} />
        ))}
      </View>
    </View>
  );
}

function OrderWordsExercise({
  built,
  pool,
  onAdd,
  onRemove,
}: {
  built: string[];
  pool: string[];
  onAdd: (word: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.answerLine}>
        {built.length === 0 ? <View style={styles.slot} /> : null}
        {built.map((word, index) => (
          <WordToken key={`${word}-${index}`} label={word} placed onPress={() => onRemove(index)} />
        ))}
      </View>
      <View style={styles.bank}>
        {pool.map((word, index) => (
          <WordToken key={`${word}-bank-${index}`} label={word} onPress={() => onAdd(word)} />
        ))}
      </View>
    </View>
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
    color: '#BE123C',
    fontWeight: '800',
    textAlign: 'right',
    fontSize: 16,
  },
  shieldsGold: {
    color: '#B45309',
  },
  track: {
    height: 16,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  fill: {
    height: 16,
    backgroundColor: '#10B981',
    borderRadius: 999,
    overflow: 'hidden',
  },
  shine: {
    height: 4,
    marginTop: 2,
    marginHorizontal: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  prompt: {
    color: '#1E3A8A',
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
  listenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
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
  block: {
    gap: 12,
  },
  answerLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
  },
  slot: {
    minWidth: 72,
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  bank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  impact: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    gap: 4,
  },
  impactOk: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  impactBad: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FDA4AF',
  },
  impactTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 16,
  },
  impactBody: {
    color: '#334155',
    lineHeight: 20,
  },
  action: {
    minHeight: 54,
    borderRadius: 16,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  actionGrow: {
    flex: 1,
  },
  skip: {
    minWidth: 112,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#94A3B8',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  skipLabel: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  buttonOk: {
    backgroundColor: '#10B981',
    borderBottomColor: '#047857',
  },
  buttonBad: {
    backgroundColor: '#F43F5E',
    borderBottomColor: '#BE123C',
  },
  buttonOff: {
    backgroundColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionLabelOff: {
    color: '#94A3B8',
  },
  nextHint: {
    color: '#1E3A8A',
    fontWeight: '700',
  },
  lessonTitle: {
    color: '#64748B',
    textAlign: 'center',
  },
});
