import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ClockTimePickerModalProps = {
  visible: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (timeHm: string) => void;
  title?: string;
};

type PickerMode = 'hour' | 'minute';

const CLOCK_SIZE = 236;
const CLOCK_CENTER = CLOCK_SIZE / 2;
const OUTER_RADIUS = 92;
const INNER_RADIUS = 56;
const MINUTE_RADIUS = 92;
const LABEL_SIZE = 36;

const pad2 = (value: number) => String(value).padStart(2, '0');

export function parseTimeHm(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

export function addOneHourHm(value: string) {
  const parsed = parseTimeHm(value);
  if (!parsed) {
    return null;
  }

  return `${pad2((parsed.hour + 1) % 24)}:${pad2(parsed.minute)}`;
}

const formatTimeHm = (hour: number, minute: number) => `${pad2(hour)}:${pad2(minute)}`;

const clockPoint = (index: number, count: number, radius: number) => {
  const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
  return {
    left: CLOCK_CENTER + radius * Math.cos(angle) - LABEL_SIZE / 2,
    top: CLOCK_CENTER + radius * Math.sin(angle) - LABEL_SIZE / 2,
  };
};

export function ClockTimePickerModal({
  visible,
  value,
  onClose,
  onConfirm,
  title = 'Selecionar horário',
}: ClockTimePickerModalProps) {
  const parsed = parseTimeHm(value) ?? { hour: 14, minute: 0 };
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [mode, setMode] = useState<PickerMode>('hour');
  const [keyboard, setKeyboard] = useState(false);
  const [hourInput, setHourInput] = useState(pad2(parsed.hour));
  const [minuteInput, setMinuteInput] = useState(pad2(parsed.minute));

  useEffect(() => {
    if (!visible) {
      return;
    }

    const next = parseTimeHm(value) ?? { hour: 14, minute: 0 };
    setHour(next.hour);
    setMinute(next.minute);
    setHourInput(pad2(next.hour));
    setMinuteInput(pad2(next.minute));
    setMode('hour');
    setKeyboard(false);
  }, [visible, value]);

  const hourItems = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hourValue) => {
        const isInner = hourValue >= 12;
        const point = clockPoint(hourValue % 12, 12, isInner ? INNER_RADIUS : OUTER_RADIUS);
        return { hourValue, ...point };
      }),
    []
  );

  const minuteItems = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const minuteValue = index * 5;
        return { minuteValue, ...clockPoint(index, 12, MINUTE_RADIUS) };
      }),
    []
  );

  const selectedRadius = mode === 'hour' ? (hour >= 12 ? INNER_RADIUS : OUTER_RADIUS) : MINUTE_RADIUS;
  const selectedIndex = mode === 'hour' ? hour % 12 : Math.round(minute / 5) % 12;
  const handRotate = (selectedIndex / 12) * 360;

  const handleConfirm = () => {
    let nextHour = hour;
    let nextMinute = minute;

    if (keyboard) {
      const parsedHour = Number(hourInput);
      const parsedMinute = Number(minuteInput);
      if (!Number.isInteger(parsedHour) || parsedHour < 0 || parsedHour > 23) {
        return;
      }
      if (!Number.isInteger(parsedMinute) || parsedMinute < 0 || parsedMinute > 59) {
        return;
      }
      nextHour = parsedHour;
      nextMinute = parsedMinute;
    }

    onConfirm(formatTimeHm(nextHour, nextMinute));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.digitalRow}>
            <TouchableOpacity
              style={[styles.digitalBox, mode === 'hour' && !keyboard && styles.digitalBoxActive]}
              onPress={() => {
                setKeyboard(false);
                setMode('hour');
              }}
              accessibilityRole="button"
              accessibilityLabel="Selecionar hora"
            >
              <Text style={[styles.digitalText, mode === 'hour' && !keyboard && styles.digitalTextActive]}>
                {pad2(hour)}
              </Text>
            </TouchableOpacity>
            <Text style={styles.digitalColon}>:</Text>
            <TouchableOpacity
              style={[styles.digitalBox, mode === 'minute' && !keyboard && styles.digitalBoxActive]}
              onPress={() => {
                setKeyboard(false);
                setMode('minute');
              }}
              accessibilityRole="button"
              accessibilityLabel="Selecionar minutos"
            >
              <Text style={[styles.digitalText, mode === 'minute' && !keyboard && styles.digitalTextActive]}>
                {pad2(minute)}
              </Text>
            </TouchableOpacity>
          </View>

          {keyboard ? (
            <View style={styles.keyboardRow}>
              <TextInput
                style={styles.keyboardInput}
                value={hourInput}
                onChangeText={(text) => setHourInput(text.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
                placeholderTextColor={MINIMAL_UI.textMuted}
              />
              <Text style={styles.digitalColon}>:</Text>
              <TextInput
                style={styles.keyboardInput}
                value={minuteInput}
                onChangeText={(text) => setMinuteInput(text.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor={MINIMAL_UI.textMuted}
              />
            </View>
          ) : (
            <View style={styles.clock}>
              <View
                pointerEvents="none"
                style={[
                  styles.hand,
                  {
                    height: selectedRadius,
                    top: CLOCK_CENTER - selectedRadius,
                    transform: [{ rotate: `${handRotate}deg` }],
                  },
                ]}
              />
              <View pointerEvents="none" style={styles.centerDot} />
              {mode === 'hour'
                ? hourItems.map((item) => {
                    const selected = item.hourValue === hour;
                    return (
                      <TouchableOpacity
                        key={`h-${item.hourValue}`}
                        style={[
                          styles.clockLabel,
                          { left: item.left, top: item.top },
                          selected && styles.clockLabelSelected,
                        ]}
                        onPress={() => {
                          setHour(item.hourValue);
                          setHourInput(pad2(item.hourValue));
                          setMode('minute');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Hora ${item.hourValue}`}
                      >
                        <Text style={[styles.clockLabelText, selected && styles.clockLabelTextSelected]}>
                          {item.hourValue}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                : minuteItems.map((item) => {
                    const selected = item.minuteValue === minute;
                    return (
                      <TouchableOpacity
                        key={`m-${item.minuteValue}`}
                        style={[
                          styles.clockLabel,
                          { left: item.left, top: item.top },
                          selected && styles.clockLabelSelected,
                        ]}
                        onPress={() => {
                          setMinute(item.minuteValue);
                          setMinuteInput(pad2(item.minuteValue));
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Minuto ${item.minuteValue}`}
                      >
                        <Text style={[styles.clockLabelText, selected && styles.clockLabelTextSelected]}>
                          {pad2(item.minuteValue)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setKeyboard((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={keyboard ? 'Abrir relógio' : 'Digitar horário'}
            >
              <MaterialIcons
                name={keyboard ? 'schedule' : 'keyboard'}
                size={22}
                color={MINIMAL_UI.accent}
              />
            </TouchableOpacity>
            <View style={styles.footerActions}>
              <TouchableOpacity onPress={onClose} accessibilityRole="button">
                <Text style={styles.footerAction}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} accessibilityRole="button">
                <Text style={styles.footerAction}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    backgroundColor: MINIMAL_UI.background,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10,
    ...boxShadowStyle({
      color: '#000',
      offsetY: 10,
      blurRadius: 24,
      opacity: 0.18,
      elevation: 10,
    }),
  },
  title: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
  },
  digitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  digitalBox: {
    minWidth: 88,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingVertical: 10,
    alignItems: 'center',
  },
  digitalBoxActive: {
    backgroundColor: '#DBEAFE',
  },
  digitalText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 40,
    fontWeight: '500',
    lineHeight: 46,
  },
  digitalTextActive: {
    color: MINIMAL_UI.accent,
  },
  digitalColon: {
    color: MINIMAL_UI.blueDark,
    fontSize: 36,
    fontWeight: '600',
  },
  keyboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: CLOCK_SIZE,
  },
  keyboardInput: {
    width: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 32,
    color: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  clock: {
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
    alignSelf: 'center',
    borderRadius: CLOCK_SIZE / 2,
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  hand: {
    position: 'absolute',
    left: CLOCK_CENTER - 1.5,
    width: 3,
    backgroundColor: MINIMAL_UI.accent,
    borderRadius: 2,
    transformOrigin: '50% 100%',
  },
  centerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: MINIMAL_UI.accent,
    left: CLOCK_CENTER - 5,
    top: CLOCK_CENTER - 5,
  },
  clockLabel: {
    position: 'absolute',
    width: LABEL_SIZE,
    height: LABEL_SIZE,
    borderRadius: LABEL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockLabelSelected: {
    backgroundColor: MINIMAL_UI.accent,
  },
  clockLabelText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '600',
  },
  clockLabelTextSelected: {
    color: MINIMAL_UI.onDark,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 6,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 22,
  },
  footerAction: {
    color: MINIMAL_UI.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
