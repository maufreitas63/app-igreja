import { InboxList, type InboxListItem } from '@/components/minimal/InboxList';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const SECTION_TITLE_FONT_SIZE = Math.round(MINIMAL_TYPO.screenTitle.fontSize * 1.3);

export function EventsInboxHome() {
  const { events, loading, error } = useActiveEvents({ enablePolling: true });

  const inboxItems: InboxListItem[] = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        subject: event.name,
        preview: event.event_local?.trim() || 'Sem local informado',
        meta: formatEventDateTimeLabel(event.event_date),
        event,
      })),
    [events]
  );

  if (loading) {
    return <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />;
  }

  if (error) {
    return <Text style={styles.error}>Não foi possível carregar os eventos.</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Proximos Eventos</Text>
      <InboxList items={inboxItems} emptyMessage="Nenhum evento disponível no momento." />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.background,
  },
  sectionTitle: {
    fontSize: SECTION_TITLE_FONT_SIZE,
    fontWeight: MINIMAL_TYPO.screenTitle.fontWeight,
    color: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loader: {
    marginVertical: 32,
  },
  error: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
