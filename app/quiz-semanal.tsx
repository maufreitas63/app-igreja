import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchMemberWeeklyQuiz,
  formatSermonDateLabel,
  submitWeeklyQuizAnswer,
  type WeeklyQuizMemberQuiz,
} from '@/lib/weeklyQuizApi';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function QuizSemanalScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<WeeklyQuizMemberQuiz | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const contextShownRef = useRef(false);
  const openContextOnEntry = String(params.contexto ?? '') === '1';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const state = await fetchMemberWeeklyQuiz();
      setQuiz(state.quiz);
      setTotalScore(state.totalScore);
      if (state.quiz?.completed) {
        setCursor(-1);
        return;
      }
      const firstOpen = state.quiz?.questions.findIndex((item) => !item.answered) ?? 0;
      setCursor(firstOpen >= 0 ? firstOpen : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o quiz.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        contextShownRef.current = false;
        setContextOpen(false);
      };
    }, [load])
  );

  useEffect(() => {
    if (!openContextOnEntry || !quiz || contextShownRef.current) {
      return;
    }

    contextShownRef.current = true;
    setContextOpen(true);
  }, [openContextOnEntry, quiz]);

  const question = quiz?.questions[cursor] ?? null;
  const finished = Boolean(quiz?.completed);
  const dateLabel = useMemo(
    () => formatSermonDateLabel(quiz?.sermonPublishedAt),
    [quiz?.sermonPublishedAt]
  );

  const choose = async (index: number) => {
    if (!question || question.answered || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await submitWeeklyQuizAnswer(question.id, index);
      setTotalScore(result.totalScore);
      setQuiz((current) => {
        if (!current) {
          return current;
        }

        const questions = current.questions.map((item) =>
          item.id === question.id
            ? {
                ...item,
                answered: true,
                selectedIndex: index,
                isCorrect: result.isCorrect,
                bibleReference: result.bibleReference,
                correctOption: result.correctOption,
              }
            : item
        );

        return {
          ...current,
          questions,
          weekScore: result.weekScore,
          answeredCount: result.answeredCount,
          completed: result.completed,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a resposta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
      <Text style={styles.kicker}>Quiz semanal</Text>
      {loading ? <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !quiz ? (
        <Text style={styles.body}>Ainda não há um desafio publicado nesta igreja.</Text>
      ) : null}

      {quiz && question ? (
        <View style={styles.questionBlock}>
          <Text style={styles.title}>{quiz.title}</Text>
          <Text style={styles.meta}>
            Pergunta {question.position} de 10
            {dateLabel ? ` · ${dateLabel}` : ''}
          </Text>
          <Text style={styles.prompt}>{question.prompt}</Text>
          {question.options.map((option, index) => {
            const selected = question.selectedIndex === index;
            return (
              <TouchableOpacity
                key={`${question.id}-${index}`}
                accessibilityRole="button"
                disabled={question.answered || busy}
                onPress={() => void choose(index)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            );
          })}

          {question.answered ? (
            <View style={styles.feedback}>
              <Text style={question.isCorrect ? styles.correct : styles.wrong}>
                {question.isCorrect ? 'Resposta correta.' : 'Resposta incorreta.'}
              </Text>
              {!question.isCorrect && question.correctOption ? (
                <Text style={styles.body}>A alternativa correta é: {question.correctOption}</Text>
              ) : null}
              {question.bibleReference ? (
                <Text style={styles.reference}>
                  {question.isCorrect
                    ? `Referência da pregação: ${question.bibleReference}`
                    : `Revisite o texto: ${question.bibleReference}`}
                </Text>
              ) : null}
              {cursor < quiz.questions.length - 1 ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setCursor((current) => current + 1)}
                  style={styles.next}
                >
                  <Text style={styles.nextText}>Próxima pergunta</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={contextOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setContextOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setContextOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Contexto da pregação</Text>
            {quiz?.title ? <Text style={styles.meta}>{quiz.title}</Text> : null}
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.body}>
                {quiz?.contextSummary || 'O contexto desta pregação ainda não está disponível.'}
              </Text>
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setContextOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Iniciar Quiz</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {quiz && finished ? (
        <View style={styles.result}>
          {!question ? <Text style={styles.title}>{quiz.title}</Text> : null}
          {!question && dateLabel ? (
            <Text style={styles.meta}>Pregação publicada em {dateLabel}</Text>
          ) : null}
          <Text style={styles.score}>Você fez {quiz.weekScore} pontos nesta pregação.</Text>
          <Text style={styles.score}>Total acumulado: {totalScore} pontos.</Text>
        </View>
      ) : null}
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 12,
    maxHeight: '80%',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTitle: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loader: {
    marginTop: 16,
  },
  title: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  prompt: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  body: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    lineHeight: 21,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
  },
  questionBlock: {
    gap: 10,
    marginTop: 12,
  },
  option: {
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: MINIMAL_UI.accent,
  },
  optionText: {
    color: MINIMAL_UI.text,
    fontSize: 15,
  },
  feedback: {
    gap: 8,
    marginTop: 4,
  },
  correct: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '800',
  },
  wrong: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '800',
  },
  reference: {
    color: MINIMAL_UI.accent,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  next: {
    alignSelf: 'flex-start',
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nextText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  result: {
    gap: 8,
    marginTop: 16,
  },
  score: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
