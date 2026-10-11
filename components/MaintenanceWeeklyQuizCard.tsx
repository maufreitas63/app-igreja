import {
  discardWeeklyQuizDraft,
  fetchWeeklyQuizAdminSnapshot,
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
  ranking: [],
};

export function MaintenanceWeeklyQuizCard({ isActive = true, panelHeight }: Props) {
  const [snapshot, setSnapshot] = useState<WeeklyQuizAdminSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <ScrollView
      style={[maintenancePanelStyles.panel, { maxHeight: contentHeight }]}
      contentContainerStyle={styles.content}
      {...MAINTENANCE_SCROLL_PROPS}
    >
      <Text style={maintenancePanelStyles.panelTitle}>Quiz semanal</Text>
      <Text style={styles.lead}>
        Busca a pregação mais recente do canal desta igreja, gera 10 perguntas e só publica depois da prévia.
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
          {busy ? 'Buscando pregação…' : 'Buscar pregação mais recente'}
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
});
