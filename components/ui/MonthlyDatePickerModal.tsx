import {
  buildMonthCalendarGrid,
  chunkCalendarGrid,
  clampCalendarDay,
  formatEventDateOnlyFromParts,
  formatMonthYearLabel,
  formatPickerSelectedDateLabel,
  parseEventDateOnlyInputParts,
  parseIsoCalendarDate,
  shiftCalendarMonth,
  WEEKDAY_LABELS_PT,
  type CalendarDateParts,
} from '@/lib/monthlyDatePicker';
import { getTodayCalendarDateInAppTimezone } from '@/lib/eventDate';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type MonthlyDatePickerModalProps = {
  visible: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (dateInput: string) => void;
  title?: string;
};

const getDefaultParts = (): CalendarDateParts => {
  const today = parseIsoCalendarDate(getTodayCalendarDateInAppTimezone());
  if (today) {
    return today;
  }

  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
};

const resolveInitialParts = (value: string): CalendarDateParts =>
  parseEventDateOnlyInputParts(value) ?? getDefaultParts();

export function MonthlyDatePickerModal({
  visible,
  value,
  onClose,
  onConfirm,
  title = 'Selecionar data',
}: MonthlyDatePickerModalProps) {
  const [draft, setDraft] = useState<CalendarDateParts>(() => resolveInitialParts(value));
  const [viewYear, setViewYear] = useState(draft.year);
  const [viewMonth, setViewMonth] = useState(draft.month);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const initial = resolveInitialParts(value);
    setDraft(initial);
    setViewYear(initial.year);
    setViewMonth(initial.month);
  }, [visible, value]);

  const todayParts = getDefaultParts();
  const weeks = useMemo(
    () => chunkCalendarGrid(buildMonthCalendarGrid(viewYear, viewMonth)),
    [viewMonth, viewYear]
  );

  const handleShiftMonth = (delta: number) => {
    const next = shiftCalendarMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
    setDraft((current) => ({
      year: next.year,
      month: next.month,
      day: clampCalendarDay(next.year, next.month, current.day),
    }));
  };

  const handleSelectDay = (day: number) => {
    setDraft({
      year: viewYear,
      month: viewMonth,
      day,
    });
  };

  const handleConfirm = () => {
    onConfirm(formatEventDateOnlyFromParts(draft));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.selectedDateRow}>
            <Text style={styles.selectedDateText}>{formatPickerSelectedDateLabel(draft)}</Text>
            <MaterialIcons name="edit-calendar" size={22} color="#5F6368" />
          </View>

          <View style={styles.monthNavRow}>
            <Text style={styles.monthNavLabel}>{formatMonthYearLabel(viewYear, viewMonth)}</Text>
            <View style={styles.monthNavButtons}>
              <TouchableOpacity
                style={styles.monthNavButton}
                onPress={() => handleShiftMonth(-1)}
                activeOpacity={0.75}
                accessibilityLabel="Mês anterior"
              >
                <MaterialIcons name="chevron-left" size={24} color="#5F6368" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.monthNavButton}
                onPress={() => handleShiftMonth(1)}
                activeOpacity={0.75}
                accessibilityLabel="Próximo mês"
              >
                <MaterialIcons name="chevron-right" size={24} color="#5F6368" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekdaysRow}>
            {WEEKDAY_LABELS_PT.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {weeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.weekRow}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.dayCell} />;
                  }

                  const isSelected =
                    draft.year === viewYear
                    && draft.month === viewMonth
                    && draft.day === day;
                  const isToday =
                    todayParts.year === viewYear
                    && todayParts.month === viewMonth
                    && todayParts.day === day;

                  return (
                    <TouchableOpacity
                      key={`day-${weekIndex}-${day}`}
                      style={styles.dayCell}
                      onPress={() => handleSelectDay(day)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Dia ${day}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View
                        style={[
                          styles.dayBadge,
                          isSelected && styles.dayBadgeSelected,
                          !isSelected && isToday && styles.dayBadgeToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.footerButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={handleConfirm} activeOpacity={0.75}>
              <Text style={styles.footerButtonText}>OK</Text>
            </TouchableOpacity>
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
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: '#E8EEF4',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  title: {
    color: '#5F6368',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  selectedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  selectedDateText: {
    flex: 1,
    color: '#1F1F1F',
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 34,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthNavLabel: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '600',
  },
  monthNavButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#5F6368',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    gap: 2,
    marginBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeSelected: {
    backgroundColor: '#1A73E8',
  },
  dayBadgeToday: {
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  dayText: {
    color: '#1F1F1F',
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  footerButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerButtonText: {
    color: '#1A73E8',
    fontSize: 15,
    fontWeight: '700',
  },
});
