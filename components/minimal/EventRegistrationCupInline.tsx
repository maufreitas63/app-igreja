import { ParticipantCupBadge } from '@/components/minimal/ParticipantCupBadge';
import { isUnlimitedEventCapacity } from '@/lib/eventCapacity';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React from 'react';
import { Text, View } from 'react-native';

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
    <View className="w-[108px] shrink-0 items-center justify-center gap-1">
      <ParticipantCupBadge
        count={event.registeredCount}
        maxCapacity={event.max_capacity}
        size="md"
      />
      <Text className="text-center text-[11px] font-bold text-minimal-icon">
        {event.registeredCount} de {limitLabel}
      </Text>
    </View>
  );
}
