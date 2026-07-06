import { EventRegistrationCupInline } from '@/components/minimal/EventRegistrationCupInline';
import { MinimalRoomSelosRow } from '@/components/minimal/MinimalRoomSelosRow';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  event: ActiveEventListItem;
  onBack: () => void;
};

/** Cabeçalho do evento expandido: voltar, dados do evento, selos e vagas. */
export function MinimalExpandedEventHeader({ event, onBack }: Props) {
  const local = event.event_local?.trim() || 'Sem local informado';
  const meta = formatEventDateTimeLabel(event.event_date);
  const showKids = Boolean(event.kids_room);
  const showTeens = Boolean(event.teens_room);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar à lista de eventos"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <FontAwesome name="chevron-left" size={14} color={MINIMAL_UI.icon} />
        <Text style={styles.backLabel}>Voltar aos eventos</Text>
      </Pressable>

      <View style={styles.summaryRow}>
        <View style={styles.summaryText}>
          <Text style={styles.subject} numberOfLines={3}>
            {event.name}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
          <Text style={styles.preview} numberOfLines={2}>
            {local}
          </Text>
          {showKids || showTeens ? (
            <View style={styles.selosSlot}>
              <MinimalRoomSelosRow showKids={showKids} showTeens={showTeens} />
            </View>
          ) : null}
        </View>
        <EventRegistrationCupInline event={event} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    backgroundColor: MINIMAL_UI.background,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backLabel: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '700',
    color: MINIMAL_UI.icon,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  subject: {
    ...MINIMAL_TYPO.inboxSubject,
    color: MINIMAL_UI.blueDark,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    color: MINIMAL_UI.blue,
  },
  preview: {
    ...MINIMAL_TYPO.inboxPreview,
    color: MINIMAL_UI.blue,
  },
  selosSlot: {
    marginTop: 6,
    width: '100%',
  },
});
