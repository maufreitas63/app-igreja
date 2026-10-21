import {
  clearWeeklyQuizScores,
  deletePublishedWeeklyQuiz,
  discardWeeklyQuizDraft,
  fetchWeeklyQuizAdminSnapshot,
  fetchWeeklyQuizSermonTranscript,
  formatSermonDateLabel,
  generateWeeklyQuizDraft,
  previewWeeklySermon,
  publishWeeklyQuiz,
  regenerateWeeklyQuizQuestions,
  type WeeklyQuizAdminSnapshot,
  type WeeklyQuizTranscriptionProgress,
  type WeeklySermonPreview,
} from '@/lib/weeklyQuizApi';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { CenteredCloseDialog } from '@/components/minimal/CenteredCloseDialog';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

const EMPTY_SNAPSHOT: WeeklyQuizAdminSnapshot = {
  youtubeUrl: null,
  draft: null,
  published: [],
  archives: [],
  ranking: [],
};

type PendingReset = {
  quizId: string;
  mode: 'scores' | 'quiz';
};

type TranscriptBar = WeeklyQuizTranscriptionProgress;

const formatVideoClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remain = total % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(remain).padStart(2, '0');
  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${paddedMinutes}:${paddedSeconds}`;
};

const QUIZ_HELP_TEXT = [
  'Buscar pregação mais recente mostra o tema, o pregador, a data e a duração do vídeo. Ao confirmar, o botão vira a barra do progresso da transcrição.',
  'Marque exatamente 10 e toque em Publicar as 10 escolhidas. O membro só vê o quiz depois dessa publicação e responde essas 10.',
  'Refazer as 15 perguntas troca o conjunto usando a transcrição já gravada.',
  'Em Pregações arquivadas sem quiz, o mesmo botão gera uma prévia nova daquela data. Com uma prévia aberta, publique ou descarte antes de gerar outra.',
  'Para refazer um quiz já publicado, exclua o quiz dessa data. A transcrição permanece e a pregação volta para a lista de arquivadas.',
].join('\n\n');

export function MaintenanceWeeklyQuizCard({ isActive = true, panelHeight }: Props) {
  const [snapshot, setSnapshot] = useState<WeeklyQuizAdminSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Aguarde…');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [transcriptTitle, setTranscriptTitle] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sermonConfirm, setSermonConfirm] = useState<WeeklySermonPreview | null>(null);
  const [transcriptBar, setTranscriptBar] = useState<TranscriptBar | null>(null);
  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSnapshot(await fetchWeeklyQuizAdminSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o quiz semanal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void load();
  }, [isActive, load]);

  const run = async (action: () => Promise<WeeklyQuizAdminSnapshot>, label: string, key: string) => {
    setBusy(true);
    setBusyLabel(label);
    setBusyKey(key);
    setError(null);

    try {
      setSnapshot(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
      setBusyKey(null);
      setTranscriptBar(null);
    }
  };

  const actionLabel = (key: string, idle: string) => (busy && busyKey === key ? busyLabel : idle);

  const openSermonConfirm = async () => {
    setBusy(true);
    setBusyLabel('Lendo a celebração…');
    setBusyKey('search');
    setError(null);

    try {
      setSermonConfirm(await previewWeeklySermon());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a celebração.');
    } finally {
      setBusy(false);
      setBusyKey(null);
    }
  };

  const confirmSermonTranscription = () => {
    const preview = sermonConfirm;
    setSermonConfirm(null);

    if (!preview?.videoId || preview.durationSeconds <= 0) {
      return;
    }

    const report = (progress: WeeklyQuizTranscriptionProgress) => {
      setTranscriptBar({
        phase: progress.phase,
        coveredSeconds: progress.coveredSeconds,
        durationSeconds: progress.durationSeconds || preview.durationSeconds,
      });
    };

    setTranscriptBar({
      phase: 'transcribe',
      coveredSeconds: preview.coveredSeconds,
      durationSeconds: preview.durationSeconds,
    });
    void run(
      () => generateWeeklyQuizDraft(
        preview.videoId,
        report,
        preview.durationSeconds,
        preview.coveredSeconds,
      ),
      'Transcrevendo a pregação…',
      'search',
    );
  };

  const draft = snapshot.draft;
  const sermonDate = formatSermonDateLabel(draft?.sermonPublishedAt);
  const draftQuestionKey = draft?.questions.map((question) => question.id).join('|') ?? '';
  const selectedCount = selectedQuestionIds.length;

  useEffect(() => {
    setSelectedQuestionIds([]);
  }, [draftQuestionKey]);

  const toggleQuestion = (questionId: string) => {
    if (!questionId) {
      return;
    }

    setSelectedQuestionIds((current) => {
      if (current.includes(questionId)) {
        return current.filter((id) => id !== questionId);
      }

      if (current.length >= 10) {
        return current;
      }

      return [...current, questionId];
    });
  };

  const openTranscript = async (videoId: string, title: string) => {
    setTranscriptTitle(title);
    setTranscriptText('');
    setTranscriptLoading(true);

    try {
      const text = await fetchWeeklyQuizSermonTranscript(videoId);
      setTranscriptText(text || 'Esta pregação não tem transcrição arquivada.');
    } catch (err) {
      setTranscriptText(err instanceof Error ? err.message : 'Não foi possível abrir a transcrição.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const closeTranscript = () => {
    setTranscriptTitle(null);
    setTranscriptText('');
  };

  return (
    <>
    <ScrollView
      style={[maintenancePanelStyles.panel, { maxHeight: contentHeight }]}
      contentContainerStyle={styles.content}
      {...MAINTENANCE_SCROLL_PROPS}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleCluster}>
          <Text style={styles.sectionTitle}>Quiz semanal</Text>
        </View>
        <View style={styles.sectionInfoSlot}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Como usar: Quiz semanal"
            onPress={() => setHelpOpen(true)}
            style={styles.sectionInfoButton}
          >
            <FontAwesome name="info-circle" size={20} color={MINIMAL_UI.icon} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator color={MINIMAL_UI.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !snapshot.youtubeUrl ? (
        <Text style={styles.hint}>Cadastre a URL do canal em Instâncias antes de buscar a pregação.</Text>
      ) : null}

      {transcriptBar ? (
        <TranscriptProgressBar progress={transcriptBar} />
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy || loading || !snapshot.youtubeUrl || Boolean(draft) || sermonConfirm !== null}
          onPress={() => void openSermonConfirm()}
          style={[styles.primaryButton, (busy || !snapshot.youtubeUrl || Boolean(draft) || sermonConfirm !== null) && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {actionLabel('search', 'Buscar pregação mais recente')}
          </Text>
        </TouchableOpacity>
      )}

      {draft ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{draft.title}</Text>
          <Text style={styles.hint}>
            Publicada em {sermonDate || 'data indisponível'} · {draft.questions.length} perguntas geradas
          </Text>
          <Text style={styles.hint}>
            Selecione 10 para publicar. {selectedCount} de 10 escolhidas.
          </Text>
          {draft.questions.map((question) => {
            const selected = selectedQuestionIds.includes(question.id);

            return (
            <View key={`${draft.id}-${question.id || question.position}`} style={styles.question}>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                disabled={busy || !question.id}
                onPress={() => toggleQuestion(question.id)}
                style={styles.choiceRow}
              >
                <Text style={selected ? styles.choiceMarkOn : styles.choiceMark}>
                  {selected ? '✓' : ''}
                </Text>
                <Text style={styles.questionTitle}>
                  {question.position}. {question.prompt}
                </Text>
              </TouchableOpacity>
              {question.options.map((option, index) => (
                <Text
                  key={`${question.position}-${index}`}
                  style={index === question.correctIndex ? styles.correctOption : styles.option}
                >
                  {index === question.correctIndex ? '● ' : '○ '}
                  {option}
                </Text>
              ))}
              <Text style={styles.reference}>Referência: {question.bibleReference}</Text>
            </View>
            );
          })}
          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy || selectedCount !== 10}
              onPress={() => void run(
                () => publishWeeklyQuiz(draft.id, selectedQuestionIds),
                'Publicando…',
                'publish'
              )}
              style={[styles.primaryButton, (busy || selectedCount !== 10) && styles.buttonDisabled]}
            >
              <Text style={styles.primaryButtonText}>
                {actionLabel('publish', 'Publicar as 10 escolhidas')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy || !draft.videoId}
              onPress={() => void run(
                () => regenerateWeeklyQuizQuestions(draft.videoId),
                'Gerando as 15 perguntas…',
                'redo-draft'
              )}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {actionLabel('redo-draft', 'Refazer as 15 perguntas')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void run(() => discardWeeklyQuizDraft(draft.id), 'Descartando a prévia…', 'discard')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {actionLabel('discard', 'Descartar prévia')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Text style={styles.rankingTitle}>Quizzes por data</Text>
      {snapshot.published.length === 0 ? (
        <Text style={styles.hint}>Nenhum quiz publicado nesta igreja.</Text>
      ) : (
        snapshot.published.map((quiz) => (
          <View key={quiz.id} style={styles.sermonCard}>
            <Text style={styles.previewTitle}>{quiz.title}</Text>
            <Text style={styles.hint}>
              {formatSermonDateLabel(quiz.sermonPublishedAt) || 'Data indisponível'}
              {' · '}
              {quiz.participantCount === 1
                ? '1 pessoa respondeu'
                : `${quiz.participantCount} pessoas responderam`}
            </Text>
            {quiz.contextSummary ? (
              <Text style={styles.summary} numberOfLines={4}>
                {quiz.contextSummary}
              </Text>
            ) : (
              <Text style={styles.hint}>Transcrição arquivada. O resumo entra ao refazer as perguntas.</Text>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy || !quiz.videoId}
              onPress={() => void openTranscript(quiz.videoId, quiz.title)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Ver transcrição</Text>
            </TouchableOpacity>
            {pendingReset?.quizId === quiz.id ? (
              <View style={styles.actions}>
                <Text style={styles.summary}>
                  {pendingReset.mode === 'scores'
                    ? 'As perguntas permanecem. Os pontos desta data saem do total e o quiz volta a abrir para resposta.'
                    : 'As perguntas e a pontuação desta data serão apagadas. A transcrição e o resumo permanecem arquivados.'}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    const mode = pendingReset.mode;
                    setPendingReset(null);
                    void run(
                      () => mode === 'scores' ? clearWeeklyQuizScores(quiz.id) : deletePublishedWeeklyQuiz(quiz.id),
                      mode === 'scores' ? 'Excluindo a pontuação…' : 'Excluindo o quiz…',
                      `reset-${quiz.id}`
                    );
                  }}
                  style={styles.dangerButton}
                >
                  <Text style={styles.dangerButtonText}>
                    {busy
                      ? 'Excluindo…'
                      : pendingReset.mode === 'scores'
                        ? 'Confirmar exclusão da pontuação'
                        : 'Confirmar exclusão do quiz'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setPendingReset(null)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setPendingReset({ quizId: quiz.id, mode: 'quiz' })}
                  style={styles.dangerButton}
                >
                  <Text style={styles.dangerButtonText}>Excluir quiz desta data</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setPendingReset({ quizId: quiz.id, mode: 'scores' })}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Excluir pontuação e liberar refação</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}

      {snapshot.archives.length ? (
        <>
          <Text style={styles.rankingTitle}>Pregações arquivadas sem quiz</Text>
          {snapshot.archives.map((sermon) => (
            <View key={sermon.videoId} style={styles.sermonCard}>
              <Text style={styles.previewTitle}>{sermon.title}</Text>
              <Text style={styles.hint}>
                {formatSermonDateLabel(sermon.sermonPublishedAt) || 'Data indisponível'}
                {' · transcrição arquivada'}
              </Text>
              {sermon.contextSummary ? (
                <Text style={styles.summary} numberOfLines={4}>
                  {sermon.contextSummary}
                </Text>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy || Boolean(draft)}
                onPress={() => void run(
                  () => regenerateWeeklyQuizQuestions(sermon.videoId),
                  'Gerando as 15 perguntas…',
                  `redo-${sermon.videoId}`
                )}
                style={[styles.primaryButton, (busy || Boolean(draft)) && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {actionLabel(`redo-${sermon.videoId}`, 'Refazer as 15 perguntas')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.rankingTitle}>Ranking cumulativo</Text>
      {snapshot.ranking.length === 0 ? (
        <Text style={styles.hint}>Ainda não há pontuação nesta igreja.</Text>
      ) : (
        snapshot.ranking.map((row, index) => (
          <View key={`${row.name}-${index}`} style={styles.rankRow}>
            <Text style={styles.rankPosition}>{index + 1}</Text>
            <Text style={styles.rankName}>{row.name}</Text>
            <Text style={styles.rankPoints}>{row.points}</Text>
          </View>
        ))
      )}
    </ScrollView>
    <Modal
      visible={sermonConfirm !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setSermonConfirm(null)}
    >
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmCard}>
          <Text style={styles.previewTitle}>Confirme a pregação</Text>
          <Text style={styles.hint}>Tema da celebração</Text>
          <Text style={styles.confirmValue}>{sermonConfirm?.theme}</Text>
          <Text style={styles.hint}>Pregador</Text>
          <Text style={styles.confirmValue}>{sermonConfirm?.preacher}</Text>
          <Text style={styles.hint}>Data da celebração</Text>
          <Text style={styles.confirmValue}>{sermonConfirm?.celebrationDate}</Text>
          <Text style={styles.hint}>Duração do vídeo</Text>
          <Text style={styles.confirmValue}>
            {sermonConfirm ? formatVideoClock(sermonConfirm.durationSeconds) : ''}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={confirmSermonTranscription}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Baixar e transcrever</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setSermonConfirm(null)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <CenteredCloseDialog
      visible={helpOpen}
      onClose={() => setHelpOpen(false)}
      title="Como usar"
      accessibilityCloseLabel="Fechar como usar"
    >
      <Text style={styles.helpText}>{QUIZ_HELP_TEXT}</Text>
    </CenteredCloseDialog>
    <Modal
      visible={transcriptTitle !== null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={closeTranscript}
    >
      <View style={styles.transcriptScreen}>
        <Text style={styles.transcriptTitle}>{transcriptTitle}</Text>
        {Platform.OS === 'web' ? (
          React.createElement(
            'div',
            { className: 'sermon-transcript-scroll', style: webTranscriptScrollStyle },
            transcriptLoading
              ? React.createElement(ActivityIndicator, { color: MINIMAL_UI.accent })
              : React.createElement('div', { style: webTranscriptBodyStyle }, transcriptText)
          )
        ) : (
          <ScrollView
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator
          >
            {transcriptLoading ? (
              <ActivityIndicator color={MINIMAL_UI.accent} />
            ) : (
              <Text style={styles.transcriptBody}>{transcriptText}</Text>
            )}
          </ScrollView>
        )}
        <TouchableOpacity accessibilityRole="button" onPress={closeTranscript} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
    </>
  );
}

function TranscriptProgressBar({ progress }: { progress: TranscriptBar }) {
  const duration = progress.durationSeconds > 0 ? progress.durationSeconds : 0;
  const covered = duration > 0 ? Math.min(duration, Math.max(0, progress.coveredSeconds)) : 0;
  const percent = progress.phase === 'compose' || (duration > 0 && covered >= duration)
    ? 100
    : duration > 0
      ? Math.round((covered / duration) * 100)
      : 0;
  const label = progress.phase === 'compose'
    ? 'Gerando as 15 perguntas…'
    : `Transcrevendo ${percent}% · ${formatVideoClock(covered)} de ${formatVideoClock(duration)}`;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${percent}%` }]} />
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  sectionHeader: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 4,
  },
  sectionTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    paddingRight: 36,
  },
  sectionInfoSlot: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 6,
  },
  sectionInfoButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpText: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 22,
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  progressTrack: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    height: 45,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    backgroundColor: '#15803D',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  progressLabel: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
    textAlign: 'center',
    zIndex: 1,
  },
  confirmBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    gap: 8,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  confirmValue: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  preview: {
    gap: 10,
  },
  previewTitle: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '800',
  },
  question: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderRadius: 10,
    gap: 4,
    padding: 10,
  },
  questionTitle: {
    color: MINIMAL_UI.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  choiceMark: {
    borderColor: MINIMAL_UI.border,
    borderRadius: 4,
    borderWidth: 1,
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '800',
    height: 22,
    lineHeight: 20,
    textAlign: 'center',
    width: 22,
  },
  choiceMarkOn: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
    borderRadius: 4,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    height: 22,
    lineHeight: 20,
    textAlign: 'center',
    width: 22,
  },
  option: {
    color: MINIMAL_UI.text,
    fontSize: 13,
  },
  correctOption: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  reference: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    gap: 8,
  },
  sermonCard: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderRadius: 12,
    gap: 8,
    padding: 12,
  },
  summary: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 18,
  },
  dangerButton: {
    borderColor: '#FECACA',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  rankingTitle: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  rankPosition: {
    color: MINIMAL_UI.accent,
    fontWeight: '800',
    width: 24,
  },
  rankName: {
    color: MINIMAL_UI.text,
    flex: 1,
    fontSize: 14,
  },
  rankPoints: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
  },
  transcriptScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    gap: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  transcriptTitle: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '800',
  },
  transcriptScroll: {
    flex: 1,
    minHeight: 0,
  },
  transcriptContent: {
    flexGrow: 0,
    paddingBottom: 12,
  },
  transcriptBody: {
    color: MINIMAL_UI.text,
    flexShrink: 0,
    fontSize: 15,
    lineHeight: 22,
  },
});

const webTranscriptScrollStyle = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowX: 'hidden',
  overflowY: 'scroll',
  paddingRight: 8,
} as const;

const webTranscriptBodyStyle = {
  color: MINIMAL_UI.text,
  fontSize: 15,
  lineHeight: '22px',
  whiteSpace: 'pre-wrap',
} as const;
