import {
  MINISTERIAL_PROFILE_QUESTIONNAIRE_SQL_HINT,
  MINISTERIAL_QUESTIONS_PER_STEP,
  MINISTERIAL_TOTAL_STEPS,
  computeMinisterialProgress,
  fetchMinisterialProfileResult,
  fetchMinisterialQuestionnaire,
  getMinisterialStepQuestions,
  submitMinisterialQuestionnaire,
  type MinisterialProfileResult,
  type MinisterialQuestion,
} from '@/lib/ministerialProfileQuestionnaire';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  profileId: string | null;
  onClose: () => void;
};

type FormPhase = 'loading' | 'intro' | 'questions' | 'submitting' | 'result' | 'error';

export function MinisterialProfileForm({ visible, profileId, onClose }: Props) {
  const [phase, setPhase] = useState<FormPhase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<MinisterialQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [existingResult, setExistingResult] = useState<MinisterialProfileResult | null>(null);
  const [submittedLabel, setSubmittedLabel] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setPhase('loading');
    setErrorMessage(null);
    setQuestions([]);
    setAnswers({});
    setStepIndex(0);
    setExistingResult(null);
    setSubmittedLabel(null);
  }, []);

  const loadData = useCallback(async () => {
    if (!profileId) {
      setErrorMessage('Perfil não identificado. Saia e entre novamente.');
      setPhase('error');
      return;
    }

    setPhase('loading');
    setErrorMessage(null);

    const [questionnaireResult, profileResult] = await Promise.all([
      fetchMinisterialQuestionnaire(),
      fetchMinisterialProfileResult(profileId),
    ]);

    if (!questionnaireResult.success) {
      setErrorMessage(questionnaireResult.message);
      setPhase('error');
      return;
    }

    setQuestions(questionnaireResult.questions);

    if (profileResult.success && profileResult.hasResult) {
      setExistingResult(profileResult.result);
      setPhase('result');
      return;
    }

    if (!profileResult.success) {
      setExistingResult(null);
    }

    setPhase('intro');
  }, [profileId]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    void loadData();
  }, [loadData, visible]);

  const stepQuestions = useMemo(
    () => getMinisterialStepQuestions(questions, stepIndex),
    [questions, stepIndex]
  );

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progress = computeMinisterialProgress(answeredCount, questions.length || 50);
  const stepProgress = ((stepIndex + 1) / MINISTERIAL_TOTAL_STEPS) * 100;
  const currentTheme = stepQuestions[0]?.bloco_tema ?? '';

  const isStepComplete = stepQuestions.every((question) => Boolean(answers[question.id]));
  const isLastStep = stepIndex >= MINISTERIAL_TOTAL_STEPS - 1;

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  };

  const handleStart = () => {
    setStepIndex(0);
    setPhase('questions');
  };

  const handleRetake = () => {
    setAnswers({});
    setStepIndex(0);
    setExistingResult(null);
    setSubmittedLabel(null);
    setPhase('intro');
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      setPhase('intro');
      return;
    }

    setStepIndex((current) => Math.max(0, current - 1));
  };

  const handleNext = async () => {
    if (!isStepComplete) {
      return;
    }

    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    if (!profileId) {
      setErrorMessage('Perfil não identificado.');
      setPhase('error');
      return;
    }

    setPhase('submitting');

    const payload = questions.map((question) => ({
      pergunta_id: question.id,
      opcao_id: answers[question.id],
    }));

    const result = await submitMinisterialQuestionnaire(profileId, payload);

    if (!result.success) {
      setErrorMessage(result.message);
      setPhase('error');
      return;
    }

    setSubmittedLabel(result.perfil_label);
    setExistingResult({
      perfil_vencedor: result.perfil_vencedor,
      perfil_label: result.perfil_label,
      completed_at: new Date().toISOString(),
    });
    setPhase('result');
  };

  const renderProgressBar = (value: number, label: string) => (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{Math.round(value)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(4, value)}%` }]} />
      </View>
    </View>
  );

  const renderBody = () => {
    if (phase === 'loading' || phase === 'submitting') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color="#34D399" size="large" />
          <Text style={styles.loadingText}>
            {phase === 'submitting' ? 'Calculando seu perfil ministerial...' : 'Carregando questionário...'}
          </Text>
        </View>
      );
    }

    if (phase === 'error') {
      return (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={36} color="#FCA5A5" />
          <Text style={styles.errorText}>{errorMessage ?? 'Não foi possível carregar.'}</Text>
          {errorMessage?.includes('ministerial-profile-questionnaire') ? (
            <Text style={styles.hintText}>{MINISTERIAL_PROFILE_QUESTIONNAIRE_SQL_HINT}</Text>
          ) : null}
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadData()} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'intro') {
      return (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Perfil Ministerial</Text>
          <Text style={styles.subtitle}>
            Responda 50 perguntas sobre sua identidade e chamado no serviço cristão. O resultado indicará o
            perfil ministerial predominante.
          </Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Como funciona</Text>
            <Text style={styles.infoItem}>• 10 etapas com 5 perguntas cada</Text>
            <Text style={styles.infoItem}>• Barra de progresso durante o preenchimento</Text>
            <Text style={styles.infoItem}>• Resultado calculado do perfil ministerial predominante</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Começar questionário</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (phase === 'result') {
      const label = submittedLabel ?? existingResult?.perfil_label ?? 'Indefinido';

      return (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.resultBadge}>
            <FontAwesome name="star" size={28} color="#FCD34D" />
          </View>
          <Text style={styles.title}>Seu perfil ministerial</Text>
          <Text style={styles.resultLabel}>{label}</Text>
          <Text style={styles.subtitle}>
            Este é o perfil predominante com base nas suas respostas. Use-o como reflexão sobre como você
            pode servir melhor na congregação.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRetake} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Refazer questionário</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>
          Etapa {stepIndex + 1} de {MINISTERIAL_TOTAL_STEPS}
        </Text>
        {currentTheme ? <Text style={styles.themeLabel}>{currentTheme}</Text> : null}
        {renderProgressBar(stepProgress, 'Progresso da etapa')}
        {renderProgressBar(progress, 'Perguntas respondidas')}

        {stepQuestions.map((question, index) => {
          const questionNumber = stepIndex * MINISTERIAL_QUESTIONS_PER_STEP + index + 1;

          return (
            <View key={question.id} style={styles.questionCard}>
              <Text style={styles.questionNumber}>Pergunta {questionNumber}</Text>
              <Text style={styles.questionText}>{question.texto}</Text>
              <View style={styles.optionsList}>
                {question.opcoes.map((option) => {
                  const selected = answers[question.id] === option.id;

                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.optionButton, selected && styles.optionButtonSelected]}
                      onPress={() => handleSelectOption(question.id, option.id)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.optionRadio, selected && styles.optionRadioSelected]} />
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {option.texto}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBack} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.primaryButtonInline, !isStepComplete && styles.buttonDisabled]}
            onPress={() => void handleNext()}
            disabled={!isStepComplete}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>{isLastStep ? 'Finalizar' : 'Próxima etapa'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Questionário de Perfil Ministerial</Text>
            <TouchableOpacity
              accessibilityLabel="Fechar questionário"
              accessibilityRole="button"
              onPress={handleClose}
              style={styles.closeButton}
              activeOpacity={0.85}
            >
              <MaterialIcons name="close" size={22} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>{renderBody()}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  container: {
    flex: 1,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#111827',
  },
  headerTitle: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    paddingRight: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51, 65, 85, 0.65)',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },
  centered: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  stepTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  themeLabel: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressBlock: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  progressValue: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#34D399',
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    padding: 14,
    gap: 6,
  },
  infoTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoItem: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 14,
    gap: 10,
  },
  questionNumber: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  optionsList: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonSelected: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748B',
    marginTop: 2,
  },
  optionRadioSelected: {
    borderColor: '#34D399',
    backgroundColor: '#34D399',
  },
  optionText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
  },
  optionTextSelected: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#34D399',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonInline: {
    flex: 1,
  },
  primaryButtonText: {
    color: '#052E16',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  resultBadge: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  resultLabel: {
    color: '#FCD34D',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  hintText: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
