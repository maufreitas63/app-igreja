import {
  buildGoogleCalendarCancelUrl,
  buildGoogleCalendarDayUrl,
  eventoAgendaFromCancelParams,
} from '@/lib/calendarIcs';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default function AgendaCancelarScreen() {
  const params = useLocalSearchParams<{
    uid?: string | string[];
    start?: string | string[];
    end?: string | string[];
    title?: string | string[];
    loc?: string | string[];
  }>();

  const evento = useMemo(
    () =>
      eventoAgendaFromCancelParams({
        uid: firstParam(params.uid),
        start: firstParam(params.start),
        end: firstParam(params.end),
        title: firstParam(params.title),
        loc: firstParam(params.loc),
      }),
    [params.end, params.loc, params.start, params.title, params.uid]
  );

  const googleUrl = evento
    ? buildGoogleCalendarCancelUrl(evento)
    : firstParam(params.start)
      ? buildGoogleCalendarDayUrl(new Date(firstParam(params.start)))
      : 'https://calendar.google.com/calendar/';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace(googleUrl);
      return;
    }

    void Linking.openURL(googleUrl);
  }, [googleUrl]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <ActivityIndicator color={MINIMAL_UI.accent} />
        <Text style={styles.title}>Abrindo o Google Agenda…</Text>
        <Text style={styles.hint}>O compromisso registrado aparece lá para você excluir.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  card: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 48,
    gap: 12,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#1E3A5F',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
