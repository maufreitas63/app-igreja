import {
  buildGoogleCalendarDayUrl,
  eventoAgendaFromCancelParams,
  openCancelEventOnDeviceCalendar,
} from '@/lib/calendarIcs';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function formatWhen(start: Date, end: Date) {
  const day = start.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const startTime = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startTime}–${endTime}`;
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

  const googleDayUrl = evento ? buildGoogleCalendarDayUrl(evento.dataInicio) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Atendimento cancelado</Text>
        <Text style={styles.title}>Remover da agenda</Text>
        {evento ? (
          <>
            <Text style={styles.when}>{formatWhen(evento.dataInicio, evento.dataFim)}</Text>
            <Text style={styles.meta}>{evento.titulo}</Text>
            {evento.local ? <Text style={styles.meta}>{evento.local}</Text> : null}
            <Text style={styles.hint}>
              Se o compromisso já estiver na sua agenda, use as opções abaixo. No Apple Calendar e
              no Outlook o arquivo de cancelamento remove o evento. No Google Agenda, abra o dia e
              exclua o compromisso.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openCancelEventOnDeviceCalendar(evento)}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Remover no Apple Calendar ou Outlook</Text>
            </Pressable>
            {googleDayUrl ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void Linking.openURL(googleDayUrl);
                }}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Abrir no Google Agenda neste dia</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.hint}>
            Este link de cancelamento está incompleto. Abra o Google Agenda no dia do atendimento e
            exclua o compromisso manualmente.
          </Text>
        )}
        {Platform.OS === 'web' ? (
          <Text style={styles.footer}>Pode fechar esta página depois de remover o compromisso.</Text>
        ) : null}
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
    paddingTop: 28,
    gap: 10,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  kicker: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#1E3A5F',
    fontSize: 22,
    fontWeight: '800',
  },
  when: {
    color: '#1E3A5F',
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    color: '#475569',
    fontSize: 14,
  },
  hint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  primary: {
    marginTop: 10,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#3A96DD',
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#1E3A5F',
    fontWeight: '800',
    textAlign: 'center',
  },
  footer: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
