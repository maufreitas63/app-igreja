import { fetchMemberWeeklyQuiz, formatSermonDateLabel } from '@/lib/weeklyQuizApi';
import { withFailClosedReturn } from '@/lib/failClosedNavigation';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function WeeklyQuizHomeBanner() {
  const router = useRouter();
  const [title, setTitle] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState('');
  const [resume, setResume] = useState(false);

  const load = useCallback(async () => {
    try {
      const state = await fetchMemberWeeklyQuiz();
      const quiz = state.quiz;

      if (!quiz || quiz.completed) {
        setTitle(null);
        setDateLabel('');
        setResume(false);
        return;
      }

      setTitle(quiz.title);
      setDateLabel(formatSermonDateLabel(quiz.sermonPublishedAt));
      setResume(quiz.answeredCount > 0);
    } catch {
      setTitle(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return subscribeActiveTenantChange(() => {
        void load();
      });
    }, [load])
  );

  if (!title) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir o quiz da pregação"
      onPress={() => {
        router.push({
          pathname: '/quiz-semanal',
          params: withFailClosedReturn({ contexto: '1' }),
        });
      }}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.kicker}>Quiz da última pregação</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta}>
          {dateLabel ? `Publicada em ${dateLabel} · ` : ''}
          {resume ? 'Continue de onde parou' : '10 perguntas para responder'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 14,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.9,
  },
  copy: {
    gap: 4,
  },
  kicker: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  meta: {
    color: '#DBEAFE',
    fontSize: 13,
  },
});
