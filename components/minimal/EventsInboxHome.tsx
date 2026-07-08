import { FamilyAgendaModal } from '@/components/FamilyAgendaModal';
import { InboxList, type InboxListItem } from '@/components/minimal/InboxList';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import {
  buildReturnToDashboardHref,
  withMinimalPresentation,
} from '@/lib/dashboardReturnNavigation';
import { MINIMAL_SECTION_TITLE, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function EventsInboxHome() {
  const router = useRouter();
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

  const handleOpenOfferings = () => {
    router.push(buildReturnToDashboardHref('3'));
  };

  const handleOpenPastoral = () => {
    void navigateWithScreenAccess(
      router,
      '/pastoral',
      ACCESS_SCREEN.pastoral,
      withMinimalPresentation()
    );
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

          <View style={styles.euQuero}>
            <Text style={styles.euQueroLabel}>Eu Quero…</Text>
            <View style={styles.euQueroActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dízimos e Ofertas"
                onPress={handleOpenOfferings}
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.actionButtonText}>Dízimos e Ofertas</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pedido de Oração"
                onPress={handleOpenPastoral}
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.actionButtonText}>Pedido de Oração</Text>
              </Pressable>
            </View>
          </View>
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
  sectionTitle: MINIMAL_SECTION_TITLE,
  loader: {
    marginVertical: 32,
  },
  error: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  euQuero: {
    marginTop: 8,
    paddingTop: 16,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    gap: 10,
  },
  euQueroLabel: {
    ...MINIMAL_TYPO.sectionLabel,
    textAlign: 'center',
  },
  euQueroActions: {
    gap: 8,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  actionButtonPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  actionButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
