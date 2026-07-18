import { ParticipantCupBadge } from '@/components/minimal/ParticipantCupBadge';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { isUnlimitedEventCapacity } from '@/lib/eventCapacity';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  event: ActiveEventListItem;
};

export function EventRegistrationCupInline({ event }: Props) {
  const limitLabel =
    event.max_capacity === null
      ? '∞'
      : isUnlimitedEventCapacity(event.max_capacity)
        ? '∞'
        : String(event.max_capacity);

  return (
    <View style={styles.wrap}>
      <ParticipantCupBadge
        count={event.registeredCount}
        maxCapacity={event.max_capacity}
        size="md"
      />
      <Text style={styles.ratio}>
        {event.registeredCount} de {limitLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 108,
    gap: 4,
  },
  ratio: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.icon,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
