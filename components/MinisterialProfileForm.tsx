import {
  MINISTERIAL_PROFILE_QUESTIONNAIRE_SQL_HINT,
  MINISTERIAL_QUESTIONS_PER_STEP,
  MINISTERIAL_TOTAL_STEPS,
  resolveMinisterialProfileResultCopy,
  computeMinisterialProgress,
  fetchMinisterialProfileResult,
  fetchMinisterialQuestionnaire,
  getMinisterialStepQuestions,
  submitMinisterialQuestionnaire,
  type MinisterialProfileResult,
  type MinisterialQuestion,
} from '@/lib/ministerialProfileQuestionnaire';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MINIMAL_SECTION_TITLE, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { fetchVolunteerOpportunitiesForMe, type VolunteerOpportunityMember } from '@/lib/volunteerOpportunitiesApi';
import { buildReturnToDashboardHref } from '@/lib/dashboardReturnNavigation';
import { useRouter } from 'expo-router';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const router = useRouter();
  const [phase, setPhase] = useState<FormPhase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<MinisterialQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [existingResult, setExistingResult] = useState<MinisterialProfileResult | null>(null);
  const [submittedLabel, setSubmittedLabel] = useState<string | null>(null);
  const [matchedVacancies, setMatchedVacancies] = useState<VolunteerOpportunityMember[]>([]);
  const questionsScrollRef = useRef<ScrollView>(null);

  const scrollQuestionsToTop = useCallback(() => {
    requestAnimationFrame(() => {
      questionsScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    });
  }, []);

  const resetState = useCallback(() => {
    setPhase('loading');
    setErrorMessage(null);
    setQuestions([]);
    setAnswers({});
    setStepIndex(0);
    setExistingResult(null);
    setSubmittedLabel(null);
    setMatchedVacancies([]);
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

  useEffect(() => {
    if (!visible || phase !== 'result') {
      return;
    }

    let cancelled = false;

    void fetchVolunteerOpportunitiesForMe()
      .then((rows) => {
        if (!cancelled) {
          setMatchedVacancies(rows.filter((row) => row.isPrimaryMatch).slice(0, 3));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatchedVacancies([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [phase, visible]);

  useLayoutEffect(() => {
    if (phase !== 'questions') {
      return;
    }

    scrollQuestionsToTop();
  }, [phase, scrollQuestionsToTop, stepIndex]);

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
          <ActivityIndicator color={MINIMAL_UI.blueDark} size="large" />
          <Text style={styles.loadingText}>
            {phase === 'submitting' ? 'Calculando seu perfil ministerial...' : 'Carregando questionário...'}
          </Text>
        </View>
      );
    }

    if (phase === 'error') {
      return (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={36} color="#DC2626" />
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
          contentContainerStyle={styles.introScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introHero}>
            <View style={styles.introBadge}>
              <FontAwesome name="clipboard" size={28} color={MINIMAL_UI.onDark} />
            </View>
            <Text style={styles.sectionTitle}>Perfil Ministerial</Text>
            <Text style={styles.introSubtitle}>
              Responda 50 perguntas sobre sua identidade e chamado no serviço cristão. O resultado indicará o
              perfil ministerial predominante.
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Como funciona</Text>
            <Text style={styles.infoItem}>• 10 etapas com 5 perguntas cada</Text>
            <Text style={styles.infoItem}>• Barra de progresso durante o preenchimento</Text>
            <Text style={styles.infoItem}>• Resultado calculado do perfil ministerial predominante</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryButton, styles.primaryButtonFull]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Começar questionário</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (phase === 'result') {
      const label = submittedLabel ?? existingResult?.perfil_label ?? 'Indefinido';
      const resultCopy = resolveMinisterialProfileResultCopy(
        existingResult?.perfil_vencedor,
        label
      );

      return (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.resultBadge}>
            <FontAwesome name="star" size={28} color={MINIMAL_UI.onDark} />
          </View>
          <Text style={styles.sectionTitle}>Seu perfil ministerial</Text>
          <Text style={styles.resultLabel}>{label}</Text>
          {resultCopy ? (
            <View style={styles.resultDescriptionBox}>
              <Text style={styles.resultDescriptionHeading}>{resultCopy.heading}</Text>
              <Text style={styles.resultDescriptionBody}>“{resultCopy.body}”</Text>
            </View>
          ) : (
            <Text style={styles.subtitle}>
              Este é o perfil predominante com base nas suas respostas. Use-o como reflexão sobre como você
              pode servir melhor na congregação.
            </Text>
          )}
          {matchedVacancies.length ? (
            <View style={styles.resultDescriptionBox}>
              <Text style={styles.resultDescriptionHeading}>
                Vimos que você tem o dom de {label}. Confira estas vagas
                {matchedVacancies[0]?.ministerioNome
                  ? ` em ${matchedVacancies[0].ministerioNome}`
                  : ''}
                :
              </Text>
              {matchedVacancies.map((row) => (
                <Text key={row.id} style={styles.resultDescriptionBody}>
                  • {row.titulo}
                  {row.ministerioNome ? ` (${row.ministerioNome})` : ''}
                </Text>
              ))}
              <TouchableOpacity
                style={[styles.primaryButton, styles.primaryButtonFull]}
                onPress={() => {
                  handleClose();
                  router.replace(buildReturnToDashboardHref('opportunity_mural_card'));
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Ver mural de oportunidades</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryButton, styles.primaryButtonFull]}
            onPress={handleRetake}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Refazer questionário</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        ref={questionsScrollRef}
        style={styles.bodyScroll}
        contentContainerStyle={styles.questionsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHero}>
          <Text style={styles.stepMeta}>
            Etapa {stepIndex + 1} de {MINISTERIAL_TOTAL_STEPS}
          </Text>
          {currentTheme ? <Text style={styles.stepThemeTitle}>{currentTheme}</Text> : null}
        </View>

        <View style={styles.progressPanel}>
          {renderProgressBar(stepProgress, 'Progresso da etapa')}
          {renderProgressBar(progress, 'Perguntas respondidas')}
        </View>

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
                      <View style={[styles.optionRadio, selected && styles.optionRadioSelected]}>
                        {selected ? <View style={styles.optionRadioDot} /> : null}
                      </View>
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
          </View>

          <View style={styles.body}>{renderBody()}</View>
          <CloseFooterBar onPress={handleClose} accessibilityLabel="Fechar questionário" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  headerTitle: {
    flex: 1,
    ...MINIMAL_TYPO.screenTitle,
    color: MINIMAL_UI.blueDark,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
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
  introScrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  questionsScrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },
  stepHero: {
    alignItems: 'center',
    gap: 8,
  },
  stepMeta: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
  },
  stepThemeTitle: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    marginBottom: 0,
  },
  progressPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    padding: 14,
    gap: 12,
  },
  introHero: {
    alignItems: 'center',
    gap: 12,
  },
  introBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    marginBottom: 0,
  },
  introSubtitle: {
    ...MINIMAL_TYPO.inboxPreview,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  centered: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    color: MINIMAL_UI.blueDark,
    textAlign: 'center',
  },
  subtitle: {
    ...MINIMAL_TYPO.inboxPreview,
    lineHeight: 21,
    textAlign: 'center',
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
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
  },
  progressValue: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    padding: 14,
    gap: 6,
  },
  infoTitle: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
    marginBottom: 4,
  },
  infoItem: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    padding: 14,
    gap: 10,
  },
  questionNumber: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
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
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonSelected: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: MINIMAL_UI.textMuted,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioSelected: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  optionRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  optionText: {
    flex: 1,
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  optionTextSelected: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonFull: {
    alignSelf: 'stretch',
    width: '100%',
  },
  primaryButtonInline: {
    flex: 1,
  },
  primaryButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blueDark,
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
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  resultLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultDescriptionBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    padding: 14,
    gap: 10,
  },
  resultDescriptionHeading: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
    lineHeight: 20,
    textAlign: 'center',
  },
  resultDescriptionBody: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  hintText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
