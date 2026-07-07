import { FamilyAgendaModal } from '@/components/FamilyAgendaModal';
import { InboxList, type InboxListItem } from '@/components/minimal/InboxList';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const SECTION_TITLE_FONT_SIZE = Math.round(MINIMAL_TYPO.screenTitle.fontSize * 1.3);

export function EventsInboxHome() {
  const { events, loading, error } = useActiveEvents({ enablePolling: true });
  const [modalEventId, setModalEventId] = useState<string | null>(null);
  const agendaOpen = modalEventId !== null;

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

  const handleItemPress = (item: InboxListItem) => {
    setModalEventId(item.id);
  };

  const handleCloseModal = () => {
    setModalEventId(null);
  };

  if (loading) {
    return <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />;
  }

  if (error) {
    return <Text style={styles.error}>Não foi possível carregar os eventos.</Text>;
  }

  return (
    <View style={styles.root}>
      {!agendaOpen ? (
        <View style={styles.inboxSection}>
          <Text style={styles.sectionTitle}>Proximos Eventos</Text>
          <InboxList
            items={inboxItems}
            emptyMessage="Nenhum evento disponível no momento."
            onItemPress={handleItemPress}
          />
        </View>
      ) : null}

      <FamilyAgendaModal
        visible={agendaOpen}
        initialEventId={modalEventId}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
  },
  inboxSection: {
    flexGrow: 0,
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
  },
  sectionTitle: {
    fontSize: SECTION_TITLE_FONT_SIZE,
    fontWeight: MINIMAL_TYPO.screenTitle.fontWeight,
    color: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
