import { EventRegistrationCupInline } from '@/components/minimal/EventRegistrationCupInline';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Faixa 50/50 acima do menu quando um evento está expandido na Início. */
export function MinimalExpandedEventBar() {
  const { expandedEvent } = useMinimalHome();

  if (!expandedEvent) {
    return null;
  }

  const local = expandedEvent.event_local?.trim() || 'Sem local informado';
  const meta = formatEventDateTimeLabel(expandedEvent.event_date);

  return (
    <View style={styles.bar}>
      <View style={styles.half}>
        <Text style={styles.preview} numberOfLines={1}>
          {local}
        </Text>
        <Text style={styles.subject} numberOfLines={2}>
          {expandedEvent.name}
        </Text>
      </View>
      <View style={[styles.half, styles.halfRight]}>
        <Text style={styles.meta} numberOfLines={2}>
          {meta}
        </Text>
        <EventRegistrationCupInline event={expandedEvent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minHeight: 52,
    marginHorizontal: -12,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  half: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    gap: 2,
  },
  halfRight: {
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: MINIMAL_UI.border,
  },
  preview: {
    ...MINIMAL_TYPO.inboxPreview,
    color: MINIMAL_UI.blue,
  },
  subject: {
    ...MINIMAL_TYPO.inboxSubject,
    color: MINIMAL_UI.blueDark,
  },
  meta: {
    fontSize: 12,
    color: MINIMAL_UI.blue,
    textAlign: 'center',
  },
});
