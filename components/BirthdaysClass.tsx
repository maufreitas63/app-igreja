import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  BIRTHDAYS_CLASS_MONTHS,
  type BirthdaysClassEntry,
} from '@/lib/birthdaysClassTypes';
import { formatBirthdayDayMonth } from '@/lib/birthdaysClassUtils';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const BIRTHDAYS_CLASS_SURFACE = '#FFFFFF';

export type BirthdaysClassProps = {
  title?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  selectedMonthLabel: string;
  entries: BirthdaysClassEntry[];
  onOpenWhatsapp?: (entry: BirthdaysClassEntry) => void;
};

/** Visualização pura de Aniversariantes — extraída de dashboard.card.birthdays. */
export function BirthdaysClass({
  title = 'Aniversariantes',
  loading = false,
  error = null,
  onRetry,
  selectedMonth,
  onMonthChange,
  selectedMonthLabel,
  entries,
  onOpenWhatsapp,
}: BirthdaysClassProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.body}>
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Selecionar Mês</Text>
          <View style={styles.monthDropdownWrap}>
            <DropdownSelect
              options={BIRTHDAYS_CLASS_MONTHS}
              selectedValue={selectedMonth}
              onValueChange={onMonthChange}
              modalTitle="Selecionar mês"
              placeholder="Selecionar mês"
              style={styles.monthDropdown}
              triggerTextStyle={styles.monthDropdownText}
              triggerIconColor={VIGILANCE_SCALES_UI.accent}
            />
          </View>
        </View>

        <Text style={styles.summaryText}>
          {entries.length} aniversariante
          {entries.length === 1 ? '' : 's'} em {selectedMonthLabel.toLowerCase()}.
        </Text>

        <View style={styles.listBox}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="large" />
            </View>
          ) : error ? (
            <View style={styles.messageBox}>
              <Text style={styles.errorText}>{error}</Text>
              {onRetry ? (
                <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
                  <Text style={styles.retryButtonText}>Atualizar lista</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : entries.length ? (
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {entries.map((entry, index) => (
                <View key={`${entry.birth_date}-${entry.full_name}-${index}`} style={styles.row}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>
                      {formatBirthdayDayMonth(entry.day, entry.month)}
                    </Text>
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.nameText}>{entry.full_name}</Text>
                    <TouchableOpacity
                      style={[styles.whatsappButton, !entry.phone && styles.whatsappButtonDisabled]}
                      onPress={() => onOpenWhatsapp?.(entry)}
                      disabled={!entry.phone}
                      activeOpacity={0.85}
                      accessibilityLabel="Abrir WhatsApp do aniversariante"
                    >
                      <FontAwesome
                        name="whatsapp"
                        size={18}
                        color={entry.phone ? '#25D366' : '#94A3B8'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>
              Nenhum aniversariante encontrado em {selectedMonthLabel.toLowerCase()}.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: BIRTHDAYS_CLASS_SURFACE,
    gap: 12,
  },
  title: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  monthDropdownWrap: {
    flex: 1,
    minWidth: 0,
    maxWidth: 220,
    marginLeft: 'auto',
  },
  monthDropdown: {
    width: '100%',
    borderColor: MINIMAL_UI.border,
    backgroundColor: BIRTHDAYS_CLASS_SURFACE,
    color: VIGILANCE_SCALES_UI.accent,
  },
  monthDropdownText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    textAlign: 'center',
  },
  listBox: {
    flex: 1,
    minHeight: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 12,
    backgroundColor: BIRTHDAYS_CLASS_SURFACE,
    overflow: 'hidden',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    paddingVertical: 24,
  },
  messageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  errorText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: BIRTHDAYS_CLASS_SURFACE,
  },
  retryButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BIRTHDAYS_CLASS_SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VIGILANCE_SCALES_UI.border,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBadge: {
    minWidth: 64,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: BIRTHDAYS_CLASS_SURFACE,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  nameText: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  whatsappButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37, 211, 102, 0.35)',
    backgroundColor: BIRTHDAYS_CLASS_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappButtonDisabled: {
    opacity: 0.55,
  },
  emptyText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.88,
    padding: 16,
    textAlign: 'center',
  },
});
