import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import {
  formatDisplayName,
  formatServiceDateLabel,
  isIntercessionScale,
  isParkingWelcomeScale,
} from '@/lib/scalesClassUtils';
import type {
  ScalesClassScaleType,
  ScalesClassScheduleEntry,
  ScalesClassVolunteerEntry,
  ScalesClassView,
} from '@/lib/scalesClassTypes';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCALES_CLASS_SURFACE = '#FFFFFF';
const SCALES_CLASS_ICON_COLOR = '#1B4F8A';

export type ScalesClassProps = {
  title?: string;
  view: ScalesClassView;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  scaleTypes?: ScalesClassScaleType[];
  selectedScaleCode?: string;
  onSelectScale?: (option: ScalesClassScaleType) => void;
  rosterTitle?: string;
  isIntercession?: boolean;
  isParking?: boolean;
  scheduleEntries?: ScalesClassScheduleEntry[];
  volunteerEntries?: ScalesClassVolunteerEntry[];
  nextServiceDate?: string | null;
  rosterLoading?: boolean;
  rosterError?: string | null;
  onRosterRetry?: () => void;
  onBack?: () => void;
  onOpenParking?: () => void;
  onOpenWhatsapp?: (phone: string | null) => void;
  parkingPanel?: React.ReactNode;
  onBackFromParking?: () => void;
  canRequestSwap?: (entry: ScalesClassScheduleEntry) => boolean;
  onRequestSwap?: (entry: ScalesClassScheduleEntry) => void;
  /** Datas futuras em que o usuário logado está escalado. */
  myScheduleEntries?: ScalesClassScheduleEntry[];
};

/** Visualização pura de Escalas — extraída de dashboard.card.vigilance_scales. */
export function ScalesClass({
  title = 'Escalas',
  view,
  loading = false,
  error = null,
  onRetry,
  scaleTypes = [],
  selectedScaleCode = '',
  onSelectScale,
  rosterTitle = 'Escala',
  isIntercession = false,
  isParking = false,
  scheduleEntries = [],
  volunteerEntries = [],
  nextServiceDate = null,
  rosterLoading = false,
  rosterError = null,
  onRosterRetry,
  onBack,
  onOpenParking,
  onOpenWhatsapp,
  parkingPanel,
  onBackFromParking,
  canRequestSwap,
  onRequestSwap,
  myScheduleEntries = [],
}: ScalesClassProps) {
  if (view === 'parking') {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{rosterTitle}</Text>
        <View style={styles.parkingPanel}>{parkingPanel}</View>
        <TouchableOpacity style={styles.backButton} onPress={onBackFromParking} activeOpacity={0.85}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (view === 'roster') {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{rosterTitle}</Text>

        {isParking ? (
          <View style={styles.parkingPrompt}>
            <TouchableOpacity
              style={styles.identifyVehicleButton}
              onPress={onOpenParking}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Identificar veículo pela placa"
            >
              <FontAwesome name="car" size={18} color={SCALES_CLASS_ICON_COLOR} />
              <Text style={styles.identifyVehicleButtonText}>Identificar veículo</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.listArea}>
          {isIntercession ? (
            rosterLoading ? (
              <LoadingState />
            ) : rosterError ? (
              <MessageState message={rosterError} onRetry={onRosterRetry} />
            ) : volunteerEntries.length ? (
              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {volunteerEntries.map((entry) => (
                  <View key={entry.id} style={styles.intercessionRow}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {formatDisplayName(entry.name)}
                    </Text>
                    <WhatsappButton
                      phone={entry.phone}
                      onPress={() => onOpenWhatsapp?.(entry.phone)}
                    />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>Nenhum servo cadastrado nesta escala.</Text>
            )
          ) : loading ? (
            <LoadingState />
          ) : error ? (
            <MessageState message={error} onRetry={onRetry} />
          ) : scheduleEntries.length ? (
            <View style={styles.tableBox}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.nameHeader]}>Nome</Text>
                <View style={styles.trailingHeader}>
                  <Text style={styles.headerCell}>Data</Text>
                  <Text style={[styles.headerCell, styles.whatsappHeader]}>Zap</Text>
                </View>
              </View>
              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {scheduleEntries.map((entry, index) => (
                  <View
                    key={`${entry.serviceDate}-${entry.volunteerId}-${index}`}
                    style={[
                      styles.scheduleRowWrap,
                      entry.serviceDate === nextServiceDate && styles.scheduleRowHighlight,
                    ]}
                  >
                    <View style={styles.scheduleRow}>
                      <Text style={styles.nameText} numberOfLines={1}>
                        {formatDisplayName(entry.volunteerName)}
                        {myScheduleEntries.some((mine) => mine.id === entry.id) ? ' · você' : ''}
                      </Text>
                      <View style={styles.trailingHeader}>
                        <Text style={styles.dateText}>
                          {formatServiceDateLabel(entry.serviceDate)}
                        </Text>
                        <WhatsappButton
                          phone={entry.volunteerPhone}
                          onPress={() => onOpenWhatsapp?.(entry.volunteerPhone)}
                        />
                      </View>
                    </View>
                    {canRequestSwap?.(entry) ? (
                      <TouchableOpacity
                        style={styles.swapButtonWide}
                        onPress={() => onRequestSwap?.(entry)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Solicitar troca nesta data"
                      >
                        <Text style={styles.swapButtonText}>Solicitar troca desta data</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <Text style={styles.emptyText}>Nenhum registro futuro nesta escala.</Text>
          )}
        </View>

        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {title.trim() ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.pickerSection}>
        <MyScaleSlots
          entries={myScheduleEntries}
          canRequestSwap={canRequestSwap}
          onRequestSwap={onRequestSwap}
        />

        <Text style={styles.sectionLabel}>Selecionar Escala</Text>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <MessageState message={error} onRetry={onRetry} retryLabel="Atualizar escalas" />
        ) : scaleTypes.length ? (
          <ScrollView
            style={styles.radioList}
            contentContainerStyle={styles.radioListContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {scaleTypes.map((option) => {
              const isSelected = selectedScaleCode === option.code;

              return (
                <Pressable
                  key={option.code}
                  style={({ pressed }) => [
                    styles.radioRow,
                    isSelected && styles.radioRowSelected,
                    pressed && styles.radioRowPressed,
                  ]}
                  onPress={() => onSelectScale?.(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.name}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                  <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Nenhum tipo de escala cadastrado ainda.</Text>
        )}
      </View>
    </View>
  );
}

function MyScaleSlots({
  entries,
  canRequestSwap,
  onRequestSwap,
}: {
  entries: ScalesClassScheduleEntry[];
  canRequestSwap?: (entry: ScalesClassScheduleEntry) => boolean;
  onRequestSwap?: (entry: ScalesClassScheduleEntry) => void;
}) {
  return (
    <View style={styles.mySlots}>
      <Text style={styles.sectionLabel}>Quando você serve</Text>
      <Text style={styles.mySlotsHint}>
        A troca vale só para este dia. Abra a data e envie o pedido a outro servo do mesmo
        ministério.
      </Text>
      {entries.length === 0 ? (
        <Text style={styles.emptyText}>
          Abra o ministério abaixo. Na lista, toque em Solicitar troca ao lado do seu nome.
        </Text>
      ) : (
        <ScrollView
          style={styles.mySlotsList}
          contentContainerStyle={styles.mySlotsListContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {entries.map((entry) => {
            const canSwap = canRequestSwap?.(entry) === true;

            return (
              <View key={`${entry.id}-${entry.serviceDate}`} style={styles.mySlotRow}>
                <View style={styles.mySlotCopy}>
                  <Text style={styles.mySlotTitle} numberOfLines={1}>
                    {entry.scaleName}
                  </Text>
                  <Text style={styles.mySlotDate}>{formatServiceDateLabel(entry.serviceDate)}</Text>
                </View>
                {canSwap ? (
                  <TouchableOpacity
                    style={styles.swapButton}
                    onPress={() => onRequestSwap?.(entry)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Solicitar troca em ${entry.scaleName}`}
                  >
                    <Text style={styles.swapButtonText}>Solicitar troca</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.mySlotBlocked}>
                    {isIntercessionScale(entry.scaleName, entry.scaleCode)
                      || isParkingWelcomeScale(entry.scaleName, entry.scaleCode)
                      ? 'Sem troca pontual neste ministério'
                      : 'Troca não liberada no seu perfil'}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="large" />
    </View>
  );
}

function MessageState({
  message,
  onRetry,
  retryLabel = 'Atualizar',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={styles.messageBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function WhatsappButton({
  phone,
  onPress,
}: {
  phone: string | null;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.whatsappButton, !phone && styles.whatsappButtonDisabled]}
      onPress={onPress}
      disabled={!phone}
      activeOpacity={0.85}
      accessibilityLabel="Abrir WhatsApp do servo"
    >
      <FontAwesome name="whatsapp" size={20} color={phone ? '#25D366' : '#94A3B8'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: SCALES_CLASS_SURFACE,
    gap: 12,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  pickerSection: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  sectionLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    paddingVertical: 24,
    backgroundColor: SCALES_CLASS_SURFACE,
  },
  messageBox: {
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
    backgroundColor: SCALES_CLASS_SURFACE,
  },
  retryButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  radioList: {
    flex: 1,
    minHeight: 0,
  },
  radioListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: SCALES_CLASS_SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  radioRowSelected: {
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: SCALES_CLASS_SURFACE,
  },
  radioRowPressed: {
    backgroundColor: '#F8FAFC',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: VIGILANCE_SCALES_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: VIGILANCE_SCALES_UI.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: VIGILANCE_SCALES_UI.accent,
  },
  radioLabel: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  radioLabelSelected: {
    color: VIGILANCE_SCALES_UI.accent,
    fontWeight: '700',
  },
  emptyText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.88,
    paddingVertical: 8,
  },
  listArea: {
    flex: 1,
    minHeight: 0,
  },
  parkingPrompt: {
    flexShrink: 0,
    paddingVertical: 4,
  },
  parkingActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  parkingActionHalf: {
    flex: 1,
    minWidth: 0,
  },
  identifyVehicleButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: '#3A96DD',
  },
  identifyVehicleButtonText: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  tableBox: {
    flex: 1,
    minHeight: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 12,
    backgroundColor: SCALES_CLASS_SURFACE,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: SCALES_CLASS_SURFACE,
  },
  headerCell: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameHeader: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  trailingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 6,
  },
  whatsappHeader: {
    width: 36,
    textAlign: 'center',
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingVertical: 2,
  },
  scheduleRowWrap: {
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: SCALES_CLASS_SURFACE,
    gap: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swapButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: VIGILANCE_SCALES_UI.accent,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  swapButtonWide: {
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: VIGILANCE_SCALES_UI.accent,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  swapButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  mySlots: {
    gap: 8,
    paddingBottom: 8,
  },
  mySlotsHint: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
  },
  mySlotsList: {
    maxHeight: 220,
  },
  mySlotsListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  mySlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F0F9FF',
  },
  mySlotCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mySlotTitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  mySlotDate: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  mySlotBlocked: {
    flexShrink: 1,
    maxWidth: 120,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  scheduleRowHighlight: {
    backgroundColor: '#F0F9FF',
  },
  intercessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: SCALES_CLASS_SURFACE,
  },
  nameText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  dateText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    textAlign: 'right',
    flexShrink: 0,
    opacity: 0.9,
  },
  whatsappButton: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  whatsappButtonDisabled: {
    opacity: 0.55,
  },
  backButton: {
    flexShrink: 0,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: SCALES_CLASS_SURFACE,
    alignItems: 'center',
  },
  backButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  parkingPanel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
