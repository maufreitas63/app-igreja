import { usePalette } from '@/context/PaletteContext';
import { EVENT_AVISOS_SQL_HINT, fetchPublishedEventAvisos, type EventAvisoRow } from '@/lib/eventAvisosApi';
import { buildIndexScreenGradient } from '@/lib/paletteTheme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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

  const loadAvisos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchPublishedEventAvisos();
      setItems(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : EVENT_AVISOS_SQL_HINT);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAvisos();
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
    <LinearGradient colors={gradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="mb-3 gap-1">
          <Pressable onPress={() => router.back()} className="mb-1 self-start px-0.5 py-1">
            <Text className="text-sm font-bold text-slate-300">Voltar</Text>
          </Pressable>
          <Text className="text-[28px] font-extrabold text-slate-50">Avisos</Text>
          <Text className="text-[13px] text-slate-400">Comunicados do culto em tempo real</Text>
        </View>

        <ScrollView contentContainerClassName="gap-3 pb-6" showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator color={colors.accent} size="large" /> : null}
          {error ? (
            <View className="gap-2 rounded-2xl border border-red-400/45 bg-slate-950/70 p-[18px]">
              <Text className="text-[13px] leading-[19px] text-red-300">{error}</Text>
            </View>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <View
              className="gap-2 rounded-2xl border bg-slate-950/70 p-[18px]"
              style={{ borderColor: `${colors.accent}55` }}
            >
              <Text className="text-base font-extrabold" style={{ color: colors.accent }}>
                Nenhum aviso publicado
              </Text>
              <Text className="text-sm leading-[21px] text-slate-300">
                Quando a equipe publicar avisos no orquestrador, eles aparecerão aqui automaticamente.
              </Text>
            </View>
          ) : null}

          {items.map((item) => (
            <View
              key={item.id}
              className="gap-2 rounded-2xl border bg-slate-950/70 p-[18px]"
              style={{ borderColor: `${colors.accent}55` }}
            >
              {item.title ? (
                <Text className="text-base font-extrabold" style={{ color: colors.accent }}>
                  {item.title}
                </Text>
              ) : null}
              <Text className="text-sm leading-[21px] text-slate-300">{item.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
