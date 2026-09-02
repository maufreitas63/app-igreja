import {
  openEventOnDeviceCalendar,
  type EventoAgenda,
} from '@/lib/calendarIcs';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  evento: EventoAgenda;
  label?: string;
  disabled?: boolean;
  onDownloaded?: () => void;
};

/**
 * Botão reutilizável: gera e baixa um .ics (Google / Apple / Outlook)
 * a partir de um EventoAgenda.
 */
export function CalendarButton({
  evento,
  label = 'Adicionar à agenda',
  disabled = false,
  onDownloaded,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy || disabled) {
      return;
    }

    setBusy(true);
    try {
      openEventOnDeviceCalendar(evento);
      onDownloaded?.();
    } catch (error) {
      console.warn('CalendarButton:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={() => {
        void handlePress();
      }}
      style={({ pressed }) => [
        styles.button,
        (disabled || busy) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <View style={styles.inner}>
        {busy ? (
          <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
        ) : (
          <FontAwesome name="calendar-plus-o" size={16} color={MINIMAL_UI.onDark} />
        )}
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '700',
  },
});
