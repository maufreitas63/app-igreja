import { EventRegistrationCupInline } from '@/components/minimal/EventRegistrationCupInline';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  menuButton: React.ReactNode;
};

/** Linha do topo: menu + evento expandido em duas metades iguais (50/50). */
export function MinimalExpandedEventBar({ menuButton }: Props) {
  const { expandedEvent } = useMinimalHome();

  if (!expandedEvent) {
    return <View style={styles.menuOnlyRow}>{menuButton}</View>;
  }

  const local = expandedEvent.event_local?.trim() || 'Sem local informado';
  const meta = formatEventDateTimeLabel(expandedEvent.event_date);

  return (
    <View style={styles.row}>
      <View style={styles.half}>
        <View style={styles.halfInner}>
          {menuButton}
          <View style={styles.textBlock}>
            <Text style={styles.subject} numberOfLines={2}>
              {expandedEvent.name}
            </Text>
            <Text style={styles.preview} numberOfLines={1}>
              {local}
            </Text>
          </View>
        </View>
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
  menuOnlyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.border,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  halfInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 4,
  },
  halfRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
    borderLeftWidth: 1,
    borderLeftColor: MINIMAL_UI.border,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
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
