import {
  fetchWeeklyQuizProfileRanking,
  type WeeklyQuizProfileRanking,
} from '@/lib/weeklyQuizApi';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function ProfileQuizRanking() {
  const [ranking, setRanking] = useState<WeeklyQuizProfileRanking | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      setRanking(await fetchWeeklyQuizProfileRanking());
    } catch {
      setRanking(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeActiveTenantChange(() => {
      void load();
    });
  }, [load]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ranking do quiz</Text>
      {loading ? <ActivityIndicator color={MINIMAL_UI.accent} /> : null}
      {!loading && ranking ? (
        <>
          <Text style={ranking.inTopFive ? styles.inTop : styles.outTop}>
            {ranking.inTopFive
              ? 'Você está entre os 5 melhores.'
              : 'Você não está entre os 5 melhores.'}
          </Text>
        </>
      ) : null}
      {!loading && !ranking ? (
        <Text style={styles.note}>O ranking desta igreja não pôde ser carregado.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#EEF3F8',
  },
  title: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '800',
  },
  inTop: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '800',
  },
  outTop: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '800',
  },
  note: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
