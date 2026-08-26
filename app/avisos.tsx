import { usePalette } from '@/context/PaletteContext';
import { EVENT_AVISOS_SQL_HINT, fetchPublishedEventAvisos, type EventAvisoRow } from '@/lib/eventAvisosApi';
import { buildIndexScreenGradient } from '@/lib/paletteTheme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AvisosScreen() {
  const router = useRouter();
  const { colors } = usePalette();
  const gradient = buildIndexScreenGradient(colors);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EventAvisoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const avisosLoadGenRef = useRef(0);

  const loadAvisos = useCallback(async () => {
    const loadId = ++avisosLoadGenRef.current;
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchPublishedEventAvisos();
      if (loadId !== avisosLoadGenRef.current) {
        return;
      }
      setItems(rows);
    } catch (loadError) {
      if (loadId !== avisosLoadGenRef.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : EVENT_AVISOS_SQL_HINT);
      setItems([]);
    } finally {
      if (loadId === avisosLoadGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAvisos();
    return () => {
      avisosLoadGenRef.current += 1;
    };
  }, [loadAvisos]);

  useEffect(() => {
    const channel = supabase
      .channel('event-avisos-public')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_avisos' },
        () => {
          void loadAvisos();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAvisos]);

  return (
    <LinearGradient colors={gradient} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
          <Text style={styles.title}>Avisos</Text>
          <Text style={styles.subtitle}>Comunicados do culto em tempo real</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator color={colors.accent} size="large" /> : null}
          {error ? (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <View style={[styles.card, { borderColor: `${colors.accent}55` }]}>
              <Text style={[styles.cardTitle, { color: colors.accent }]}>Nenhum aviso publicado</Text>
              <Text style={styles.cardBody}>
                Quando a equipe publicar avisos no orquestrador, eles aparecerão aqui automaticamente.
              </Text>
            </View>
          ) : null}

          {items.map((item) => (
            <View key={item.id} style={[styles.card, { borderColor: `${colors.accent}55` }]}>
              {item.title ? (
                <Text style={[styles.cardTitle, { color: colors.accent }]}>{item.title}</Text>
              ) : null}
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    marginBottom: 12,
    gap: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  backButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
  },
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    padding: 18,
    gap: 8,
  },
  errorCard: {
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 19,
  },
});
