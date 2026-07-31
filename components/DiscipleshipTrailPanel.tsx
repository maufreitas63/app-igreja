import {
  completeLessonWithAchievements,
  DISCIPLESHIP_TRAIL_SQL_HINT,
  fetchDiscipleshipTrailForCurrentUser,
  type DiscipleshipAchievementEvent,
  type DiscipleshipLessonWithProgress,
  type DiscipleshipModuleWithLessons,
  type DiscipleshipTrailSnapshot,
  type DiscipleshipVisualState,
  visualStateLabel,
} from '@/lib/discipleshipTrail';
import { isMinisterialGiftsLesson } from '@/lib/discipleshipMinisterialLesson';
import { fetchMinisterialProfileResult } from '@/lib/ministerialProfileQuestionnaire';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MinisterialProfileForm } from '@/components/MinisterialProfileForm';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  onClose?: () => void;
};

const STATE_COLORS: Record<DiscipleshipVisualState, string> = {
  locked: '#94A3B8',
  available: MINIMAL_UI.blueDark,
  in_progress: '#D97706',
  completed: '#059669',
};

export function DiscipleshipTrailPanel({ onClose }: Props) {
  const [snapshot, setSnapshot] = useState<DiscipleshipTrailSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<{
    module: DiscipleshipModuleWithLessons;
    lesson: DiscipleshipLessonWithProgress;
  } | null>(null);
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [ministerialFormVisible, setMinisterialFormVisible] = useState(false);
  const [hasMinisterialResult, setHasMinisterialResult] = useState(false);
  const [achievement, setAchievement] = useState<DiscipleshipAchievementEvent | null>(null);
  const celebrateScale = useRef(new Animated.Value(0.6)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;

  const loadTrail = useCallback(async (options?: { refresh?: boolean }) => {
    const isRefresh = options?.refresh === true;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const next = await fetchDiscipleshipTrailForCurrentUser();
      setSnapshot(next);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível carregar a trilha.';
      setErrorMessage(
        message.toLowerCase().includes('does not exist') || message.includes('PGRST')
          ? DISCIPLESHIP_TRAIL_SQL_HINT
          : message
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTrail();
  }, [loadTrail]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await resolveEffectiveProfileId();
      if (!cancelled) {
        setProfileId(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMinisterialResult = useCallback(async (id: string | null) => {
    if (!id) {
      setHasMinisterialResult(false);
      return;
    }
    const result = await fetchMinisterialProfileResult(id);
    setHasMinisterialResult(Boolean(result.success && result.hasResult));
  }, []);

  useEffect(() => {
    if (!achievement) {
      return;
    }

    celebrateScale.setValue(0.6);
    celebrateOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(celebrateScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(celebrateOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [achievement, celebrateOpacity, celebrateScale]);

  const openLesson = (
    module: DiscipleshipModuleWithLessons,
    lesson: DiscipleshipLessonWithProgress
  ) => {
    if (lesson.visualState === 'locked') {
      return;
    }
    setSelectedLesson({ module, lesson });
    setReflectionAnswer(lesson.progress?.reflection_answer ?? '');
    if (isMinisterialGiftsLesson(module, lesson)) {
      void refreshMinisterialResult(profileId);
    } else {
      setHasMinisterialResult(false);
    }
  };

  const handleStartLesson = async () => {
    if (!selectedLesson || selectedLesson.lesson.visualState === 'locked') {
      return;
    }

    setSaving(true);
    try {
      const result = await completeLessonWithAchievements({
        lessonId: selectedLesson.lesson.id,
        tenantId: selectedLesson.lesson.tenant_id,
        status: 'in_progress',
        reflectionAnswer: reflectionAnswer.trim() || null,
      });
      setSnapshot(result.snapshot);
      setSelectedLesson((current) =>
        current
          ? {
              ...current,
              lesson: {
                ...current.lesson,
                progress: result.progress,
                visualState: 'in_progress',
              },
            }
          : null
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao iniciar a lição.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteLesson = async () => {
    if (!selectedLesson || selectedLesson.lesson.visualState === 'locked') {
      return;
    }

    const needsReflection = Boolean(selectedLesson.lesson.reflection_question?.trim());
    if (needsReflection && reflectionAnswer.trim().length < 3) {
      setErrorMessage('Responda a pergunta de reflexão antes de concluir.');
      return;
    }

    if (isMinisterialGiftsLesson(selectedLesson.module, selectedLesson.lesson)) {
      await refreshMinisterialResult(profileId);
      const latest = profileId ? await fetchMinisterialProfileResult(profileId) : null;
      const filled = Boolean(latest?.success && latest.hasResult);
      setHasMinisterialResult(filled);
      if (!filled) {
        Toast.show({
          type: 'info',
          text1: 'Perfil Ministerial pendente',
          text2: 'Preencha o questionário de dons antes de concluir esta lição.',
          visibilityTime: 3500,
        });
        return;
      }
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const result = await completeLessonWithAchievements({
        lessonId: selectedLesson.lesson.id,
        tenantId: selectedLesson.lesson.tenant_id,
        status: 'completed',
        reflectionAnswer: reflectionAnswer.trim() || null,
      });
      setSnapshot(result.snapshot);
      setSelectedLesson(null);

      if (result.achievement.moduleJustCompleted || result.achievement.trailJustCompleted) {
        setAchievement(result.achievement);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao concluir a lição.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={MINIMAL_UI.blueDark} size="large" />
        <Text style={styles.loadingText}>Carregando sua trilha...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTrail({ refresh: true })}
            tintColor={MINIMAL_UI.blueDark}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Trilha de Discipulado</Text>
          <Text style={styles.heroSubtitle}>
            Avance lição a lição. Cada módulo concluído libera um selo; ao finalizar a trilha, a
            liderança é avisada para o reconhecimento.
          </Text>

          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progresso total</Text>
            <Text style={styles.progressValue}>{snapshot?.percentComplete ?? 0}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(4, snapshot?.percentComplete ?? 0)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressMeta}>
            {snapshot?.completedLessons ?? 0} de {snapshot?.totalLessons ?? 0} lições concluídas
          </Text>
        </View>

        {(snapshot?.badges.length ?? 0) > 0 ? (
          <View style={styles.badgesSection}>
            <Text style={styles.sectionTitle}>Seus selos</Text>
            <View style={styles.badgesRow}>
              {snapshot?.badges.map((badge) => (
                <View key={badge.id} style={styles.badgeChip}>
                  <FontAwesome
                    name={badge.badge_code === 'trail_complete' ? 'trophy' : 'certificate'}
                    size={14}
                    color="#B45309"
                  />
                  <Text style={styles.badgeChipText}>{badge.badge_title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {(snapshot?.modules ?? []).map((module) => (
          <View
            key={module.id}
            style={[
              styles.moduleCard,
              module.visualState === 'locked' && styles.moduleCardLocked,
              module.visualState === 'completed' && styles.moduleCardDone,
            ]}
          >
            <View style={styles.moduleHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                {module.description ? (
                  <Text style={styles.moduleDescription}>{module.description}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statePill,
                  { borderColor: STATE_COLORS[module.visualState] },
                ]}
              >
                <Text style={[styles.statePillText, { color: STATE_COLORS[module.visualState] }]}>
                  {visualStateLabel(module.visualState)}
                </Text>
              </View>
            </View>

            <View style={styles.moduleProgressHeader}>
              <Text style={styles.moduleProgressLabel}>{module.percentComplete}%</Text>
              {module.badge ? (
                <View style={styles.moduleBadgeInline}>
                  <FontAwesome name="certificate" size={12} color="#B45309" />
                  <Text style={styles.moduleBadgeText}>Selo conquistado</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(module.percentComplete > 0 ? 4 : 0, module.percentComplete)}%`,
                    backgroundColor: STATE_COLORS[module.visualState],
                  },
                ]}
              />
            </View>

            <View style={styles.lessonsList}>
              {module.lessons.map((lesson, index) => {
                const locked = lesson.visualState === 'locked';
                return (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[
                      styles.lessonRow,
                      locked && styles.lessonRowLocked,
                      lesson.visualState === 'completed' && styles.lessonRowDone,
                    ]}
                    activeOpacity={locked ? 1 : 0.85}
                    onPress={() => openLesson(module, lesson)}
                    disabled={locked}
                  >
                    <View
                      style={[
                        styles.lessonIndex,
                        { backgroundColor: STATE_COLORS[lesson.visualState] },
                      ]}
                    >
                      {lesson.visualState === 'completed' ? (
                        <FontAwesome name="check" size={12} color="#FFF" />
                      ) : lesson.visualState === 'locked' ? (
                        <FontAwesome name="lock" size={11} color="#FFF" />
                      ) : (
                        <Text style={styles.lessonIndexText}>{index + 1}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.lessonTitle, locked && styles.lessonTitleLocked]}>
                        {lesson.title}
                      </Text>
                      <Text style={styles.lessonState}>{visualStateLabel(lesson.visualState)}</Text>
                    </View>
                    {!locked ? (
                      <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {onClose ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Fechar</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal
        visible={Boolean(selectedLesson)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedLesson(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedLesson(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalEyebrow}>{selectedLesson?.module.title}</Text>
              <Text style={styles.modalTitle}>{selectedLesson?.lesson.title}</Text>
              {selectedLesson?.lesson.content ? (
                <Text style={styles.modalBody}>{selectedLesson.lesson.content}</Text>
              ) : (
                <Text style={styles.modalBodyMuted}>
                  Conteúdo de apoio ainda não personalizado pela liderança.
                </Text>
              )}
              {selectedLesson
              && isMinisterialGiftsLesson(selectedLesson.module, selectedLesson.lesson) ? (
                <View style={styles.ministerialBlock}>
                  <Text style={styles.ministerialHint}>
                    Nesta lição você descobre seus dons preenchendo o Perfil Ministerial.
                  </Text>
                  <TouchableOpacity
                    style={styles.ministerialButton}
                    onPress={() => setMinisterialFormVisible(true)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Perfil Ministerial"
                  >
                    <FontAwesome name="list-alt" size={16} color={MINIMAL_UI.blueDark} />
                    <Text style={styles.ministerialButtonText}>Perfil Ministerial</Text>
                  </TouchableOpacity>
                  <Text style={styles.ministerialStatus}>
                    {hasMinisterialResult
                      ? 'Questionário concluído — você já pode finalizar a lição.'
                      : 'Status: pendente — abra o botão acima para responder.'}
                  </Text>
                </View>
              ) : selectedLesson?.lesson.video_url ? (
                <TouchableOpacity
                  style={styles.videoButton}
                  onPress={() => {
                    const url = selectedLesson.lesson.video_url?.trim();
                    if (!url) return;
                    void Linking.openURL(url).catch(() => {
                      Toast.show({
                        type: 'error',
                        text1: 'Não foi possível abrir o vídeo',
                        text2: 'Verifique se o link está correto.',
                      });
                    });
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="link"
                  accessibilityLabel="Abrir vídeo da lição"
                >
                  <FontAwesome name="play-circle" size={18} color={MINIMAL_UI.blueDark} />
                  <View style={styles.videoButtonCopy}>
                    <Text style={styles.videoButtonTitle}>Assistir vídeo</Text>
                    <Text style={styles.videoButtonUrl} numberOfLines={1}>
                      {selectedLesson.lesson.video_url}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : selectedLesson?.lesson.title === 'Bem-vindo à Família' ? (
                <Text style={styles.modalBodyMuted}>Espaço reservado para link de vídeo.</Text>
              ) : null}

              {selectedLesson?.lesson.reflection_question ? (
                <View style={styles.reflectionBlock}>
                  <Text style={styles.reflectionLabel}>
                    {selectedLesson.lesson.reflection_question}
                  </Text>
                  <TextInput
                    style={styles.reflectionInput}
                    multiline
                    value={reflectionAnswer}
                    onChangeText={setReflectionAnswer}
                    placeholder="Escreva sua reflexão..."
                    placeholderTextColor={MINIMAL_UI.textMuted}
                    editable={selectedLesson.lesson.visualState !== 'completed'}
                  />
                </View>
              ) : null}

              <View style={styles.modalActions}>
                {selectedLesson?.lesson.visualState !== 'completed'
                  && selectedLesson?.lesson.visualState !== 'in_progress' ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => void handleStartLesson()}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.secondaryButtonText}>Iniciar</Text>
                  </TouchableOpacity>
                ) : null}

                {selectedLesson?.lesson.visualState !== 'completed' ? (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => void handleCompleteLesson()}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Concluir lição</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => setSelectedLesson(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonText}>Fechar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(achievement)}
        transparent
        animationType="fade"
        onRequestClose={() => setAchievement(null)}
      >
        <View style={styles.celebrateBackdrop}>
          <Animated.View
            style={[
              styles.celebrateCard,
              { opacity: celebrateOpacity, transform: [{ scale: celebrateScale }] },
            ]}
          >
            <View style={styles.celebrateIcon}>
              <FontAwesome
                name={achievement?.trailJustCompleted ? 'trophy' : 'certificate'}
                size={32}
                color="#FFF"
              />
            </View>
            <Text style={styles.celebrateTitle}>
              {achievement?.trailJustCompleted ? 'Trilha concluída!' : 'Selo conquistado!'}
            </Text>
            <Text style={styles.celebrateBody}>
              {achievement?.trailBadge?.badge_title
                ?? achievement?.moduleBadge?.badge_title
                ?? 'Parabéns pelo avanço na jornada.'}
            </Text>
            {achievement?.trailJustCompleted ? (
              <Text style={styles.celebrateHint}>
                A liderança pastoral foi notificada para o certificado ou reconhecimento público.
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setAchievement(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <MinisterialProfileForm
        visible={ministerialFormVisible}
        profileId={profileId}
        onClose={() => {
          setMinisterialFormVisible(false);
          void refreshMinisterialResult(profileId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  hero: {
    gap: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  heroTitle: {
    ...MINIMAL_SECTION_TITLE,
    color: MINIMAL_UI.blueDark,
  },
  heroSubtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  progressHeader: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  progressValue: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
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
  progressMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  badgesSection: { gap: 8 },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.35)',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  badgeChipText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 220,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 18,
  },
  moduleCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: '#FFF',
    padding: 14,
    gap: 10,
  },
  moduleCardLocked: {
    opacity: 0.72,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  moduleCardDone: {
    borderColor: 'rgba(5, 150, 105, 0.35)',
  },
  moduleHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  moduleTitle: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '700',
  },
  moduleDescription: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  statePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  moduleProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleProgressLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  moduleBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moduleBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  lessonsList: { gap: 8, marginTop: 4 },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  lessonRowLocked: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  lessonRowDone: {
    borderColor: 'rgba(5, 150, 105, 0.28)',
  },
  lessonIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonIndexText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  lessonTitle: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '600',
  },
  lessonTitleLocked: {
    color: MINIMAL_UI.textMuted,
  },
  lessonState: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: MINIMAL_UI.blueDark,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    maxHeight: '88%',
    borderRadius: 16,
    backgroundColor: '#FFF',
    padding: 18,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  modalEyebrow: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalBody: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 21,
  },
  modalBodyMuted: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  videoButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(27, 79, 138, 0.06)',
  },
  videoButtonCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  videoButtonTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  videoButtonUrl: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  ministerialBlock: {
    marginTop: 12,
    gap: 10,
  },
  ministerialHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  ministerialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  ministerialButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  ministerialStatus: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  reflectionBlock: {
    marginTop: 14,
    gap: 8,
  },
  reflectionLabel: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reflectionInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  modalActions: {
    marginTop: 16,
    gap: 8,
  },
  celebrateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  celebrateCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#FFF',
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  celebrateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  celebrateTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  celebrateBody: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  celebrateHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 6,
  },
});
