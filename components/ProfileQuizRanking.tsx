import {
  fetchWeeklyQuizProfileRanking,
  type WeeklyQuizProfileRanking,
} from '@/lib/weeklyQuizApi';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const formatPlace = (position: number) => `${position}º`;

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
          <Text style={styles.mine}>
            Sua posição: {formatPlace(ranking.position)} · {ranking.totalPoints} pontos
          </Text>
          {ranking.top.map((row) => (
            <View key={`${row.position}-${row.name}`} style={[styles.row, row.isMe && styles.rowMine]}>
              <Text style={styles.place}>{formatPlace(row.position)}</Text>
              <Text style={styles.name}>{row.isMe ? 'Você' : row.name}</Text>
              <Text style={styles.points}>{row.points}</Text>
            </View>
          ))}
          {!ranking.inTopFive && ranking.me ? (
            <View style={[styles.row, styles.rowMine]}>
              <Text style={styles.place}>{formatPlace(ranking.me.position)}</Text>
              <Text style={styles.name}>Você</Text>
              <Text style={styles.points}>{ranking.me.points}</Text>
            </View>
          ) : null}
          <Text style={styles.note}>No empate, fica à frente quem respondeu primeiro.</Text>
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
    backgroundColor: '#FFFFFF',
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
  mine: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowMine: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  place: {
    width: 28,
    color: MINIMAL_UI.accent,
    fontWeight: '800',
  },
  name: {
    flex: 1,
    color: MINIMAL_UI.text,
    fontSize: 14,
  },
  points: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
  },
  note: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
