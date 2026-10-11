import {
  clearWeeklyQuizScores,
  deletePublishedWeeklyQuiz,
  discardWeeklyQuizDraft,
  fetchWeeklyQuizAdminSnapshot,
  fetchWeeklyQuizSermonTranscript,
  formatSermonDateLabel,
  generateWeeklyQuizDraft,
  publishWeeklyQuiz,
  type WeeklyQuizAdminSnapshot,
} from '@/lib/weeklyQuizApi';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
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

export function MaintenanceWeeklyQuizCard({ isActive = true, panelHeight }: Props) {
  const [snapshot, setSnapshot] = useState<WeeklyQuizAdminSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);
  const [transcriptTitle, setTranscriptTitle] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptLoading, setTranscriptLoading] = useState(false);
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

  const run = async (action: () => Promise<WeeklyQuizAdminSnapshot>) => {
    setBusy(true);
    setError(null);

    try {
      setSnapshot(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  };

  const draft = snapshot.draft;
  const sermonDate = formatSermonDateLabel(draft?.sermonPublishedAt);

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
      <Text style={maintenancePanelStyles.panelTitle}>Quiz semanal</Text>
      <Text style={styles.lead}>
        Busca a pregação mais recente, transcreve a mensagem do início ao fim e gera 10 perguntas sobre essa transcrição completa. A prévia precisa ser publicada para o membro ver o quiz.
      </Text>

      {loading ? <ActivityIndicator color={MINIMAL_UI.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !snapshot.youtubeUrl ? (
        <Text style={styles.hint}>Cadastre a URL do canal em Instâncias antes de buscar a pregação.</Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy || loading || !snapshot.youtubeUrl || Boolean(draft)}
        onPress={() => void run(generateWeeklyQuizDraft)}
        style={[styles.primaryButton, (busy || !snapshot.youtubeUrl || Boolean(draft)) && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonText}>
          {busy ? 'Transcrevendo a pregação…' : 'Buscar pregação mais recente'}
        </Text>
      </TouchableOpacity>

      {draft ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{draft.title}</Text>
          <Text style={styles.hint}>
            Publicada em {sermonDate || 'data indisponível'} · vídeo {draft.videoId}
          </Text>
          {draft.questions.map((question) => (
            <View key={`${draft.id}-${question.position}`} style={styles.question}>
              <Text style={styles.questionTitle}>
                {question.position}. {question.prompt}
              </Text>
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
          ))}
          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void run(() => publishWeeklyQuiz(draft.id))}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Publicar desafio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void run(() => discardWeeklyQuizDraft(draft.id))}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Descartar prévia</Text>
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
                    void run(() =>
                      mode === 'scores' ? clearWeeklyQuizScores(quiz.id) : deletePublishedWeeklyQuiz(quiz.id)
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
                onPress={() => void run(() => generateWeeklyQuizDraft(sermon.videoId))}
                style={[styles.primaryButton, (busy || Boolean(draft)) && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? 'Transcrevendo a pregação…' : 'Refazer perguntas desta data'}
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

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  lead: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 14,
    fontWeight: '700',
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
