import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { isUnlimitedEventCapacity } from '@/lib/eventCapacity';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

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
    <Text style={styles.label} accessibilityRole="text">
      Inscritos {registeredCount} / Limite {limitLabel}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.text,
    fontWeight: '600',
  },
});
