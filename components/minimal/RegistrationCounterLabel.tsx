import { isUnlimitedEventCapacity } from '@/lib/eventCapacity';
import React from 'react';
import { Text } from 'react-native';

type Props = {
  registeredCount: number;
  maxCapacity: number | null;
};

export function RegistrationCounterLabel({ registeredCount, maxCapacity }: Props) {
  const limitLabel =
    maxCapacity === null
      ? 'Sem limite'
      : isUnlimitedEventCapacity(maxCapacity)
        ? 'Ilimitado'
        : String(maxCapacity);

  return (
    <Text className="text-minimal-label font-semibold text-minimal-text" accessibilityRole="text">
      Inscritos {registeredCount} / Limite {limitLabel}
    </Text>
  );
}
