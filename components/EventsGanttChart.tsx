import {
  buildEventsGanttModel,
  type GanttSourceEvent,
  type GanttViewMode,
} from '@/lib/eventsGantt';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const LABEL_COLUMN_WIDTH = 132;
const LABEL_COLUMN_WIDTH_MINIMAL = 108;
const DAY_COLUMN_WIDTH = 54;
const MONTH_COLUMN_WIDTH = 68;
/** Nome (até 3 linhas) + local (1 linha) + padding da célula. */
const ROW_HEIGHT = 80;
const EVENT_NAME_MAX_LINES = 3;
const HEADER_HEIGHT = 46;
const BODY_MAX_HEIGHT = 420;

type EventsGanttChartProps = {
  events: GanttSourceEvent[];
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onEventPress?: (eventId: string) => void;
  minimal?: boolean;
};

export const EventsGanttChart = ({
  events,
  loading = false,
  error = null,
  onRetry,
  onEventPress,
  minimal = false,
}: EventsGanttChartProps) => {
  const [viewMode, setViewMode] = useState<GanttViewMode>('day');
  const safeEvents = useMemo(() => events ?? [], [events]);
  const model = useMemo(() => buildEventsGanttModel(safeEvents, viewMode), [safeEvents, viewMode]);
  const eventCountByCalendarDate = useMemo(() => {
    if (!model) {
      return {} as Record<string, number>;
    }

    const counts: Record<string, number> = {};
    for (const row of model.rows) {
      counts[row.calendarDate] = (counts[row.calendarDate] ?? 0) + 1;
    }

    return counts;
  }, [model]);
  const leftScrollRef = useRef<ScrollView>(null);
  const rightScrollRef = useRef<ScrollView>(null);
  const isSyncingVerticalScrollRef = useRef(false);

  const columnWidth = viewMode === 'month' ? MONTH_COLUMN_WIDTH : DAY_COLUMN_WIDTH;
  const labelColumnWidth = minimal ? LABEL_COLUMN_WIDTH_MINIMAL : LABEL_COLUMN_WIDTH;
  const datesWidth = model ? model.dateColumns.length * columnWidth : 0;
  const periodUnitLabel = viewMode === 'month' ? 'mês' : 'dia';
  const periodUnitLabelPlural = viewMode === 'month' ? 'meses' : 'dias';

  const syncVerticalScroll = useCallback(
    (source: 'left' | 'right', event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isSyncingVerticalScrollRef.current) {
        return;
      }

      const offsetY = event.nativeEvent.contentOffset.y;
      isSyncingVerticalScrollRef.current = true;

      if (source === 'left') {
        rightScrollRef.current?.scrollTo({ y: offsetY, animated: false });
      } else {
        leftScrollRef.current?.scrollTo({ y: offsetY, animated: false });
      }

      requestAnimationFrame(() => {
        isSyncingVerticalScrollRef.current = false;
      });
    },
    []
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={minimal ? MINIMAL_UI.accent : '#818CF8'} size="large" />
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>Carregando cronograma…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error.message}</Text>
        {onRetry ? (
          <TouchableOpacity
            style={[styles.retryButton, minimal && styles.retryButtonMinimal]}
            onPress={onRetry}
            activeOpacity={0.85}
          >
            <Text style={[styles.retryButtonText, minimal && styles.retryButtonTextMinimal]}>
              Atualizar
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!model) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, minimal && styles.emptyTitleMinimal]}>
          Nenhum evento ativo agendado
        </Text>
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Cadastre eventos com data de hoje ou futura para visualizar no cronograma (publicados ou
          rascunho).
        </Text>
      </View>
    );
  }

  const resolveRowScheduledInColumn = (row: (typeof model.rows)[number], columnKey: string) =>
    viewMode === 'month' ? row.calendarMonth === columnKey : row.calendarDate === columnKey;

  return (
    <View style={[styles.container, minimal && styles.containerMinimal]}>
      <View style={[styles.headerToolbar, minimal && styles.headerToolbarMinimal]}>
        <View style={[styles.legendRow, minimal && styles.legendRowMinimal]}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendSwatch,
                styles.legendSwatchPublished,
                minimal && styles.legendSwatchCircle,
                minimal && styles.legendSwatchPublishedMinimal,
              ]}
            />
            <Text style={[styles.legendText, minimal && styles.legendTextMinimal]}>Publicado</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendSwatch,
                styles.legendSwatchDraft,
                minimal && styles.legendSwatchCircle,
                minimal && styles.legendSwatchDraftMinimal,
              ]}
            />
            <Text style={[styles.legendText, minimal && styles.legendTextMinimal]}>Rascunho</Text>
          </View>
        </View>

        <View style={[styles.viewModeToggle, minimal && styles.viewModeToggleMinimal]}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'day' && styles.viewModeButtonActive,
              minimal && styles.viewModeButtonMinimal,
              minimal && viewMode === 'day' && styles.viewModeButtonActiveMinimal,
            ]}
            onPress={() => setViewMode('day')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'day' }}
          >
            <Text
              style={[
                styles.viewModeButtonText,
                viewMode === 'day' && styles.viewModeButtonTextActive,
                minimal && styles.viewModeButtonTextMinimal,
                minimal && viewMode === 'day' && styles.viewModeButtonTextActiveMinimal,
              ]}
            >
              Por dia
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'month' && styles.viewModeButtonActive,
              minimal && styles.viewModeButtonMinimal,
              minimal && viewMode === 'month' && styles.viewModeButtonActiveMinimal,
            ]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'month' }}
          >
            <Text
              style={[
                styles.viewModeButtonText,
                viewMode === 'month' && styles.viewModeButtonTextActive,
                minimal && styles.viewModeButtonTextMinimal,
                minimal && viewMode === 'month' && styles.viewModeButtonTextActiveMinimal,
              ]}
            >
              Por mês
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.legendMeta, minimal && styles.legendMetaMinimal]}>
        {model.rows.length} evento{model.rows.length === 1 ? '' : 's'} · {model.dateColumns.length}{' '}
        {model.dateColumns.length === 1 ? periodUnitLabel : periodUnitLabelPlural}
      </Text>
      <Text style={[styles.legendHint, minimal && styles.legendHintMinimal]}>
        Publicado = visível no app dos membros. Rascunho = Publicação desligada ao editar o evento
        (lista de eventos mostra como Inativo).
      </Text>

      <View style={[styles.gridShell, minimal && styles.gridShellMinimal]}>
        {/* Coluna fixa: cabeçalho + nomes dos eventos */}
        <View
          style={[
            styles.frozenColumn,
            { width: labelColumnWidth },
            minimal && styles.frozenColumnMinimal,
          ]}
        >
          <View
            style={[
              styles.headerLabelCell,
              { height: HEADER_HEIGHT, width: labelColumnWidth },
              minimal && styles.headerLabelCellMinimal,
            ]}
          >
            <Text style={[styles.headerLabelText, minimal && styles.headerLabelTextMinimal]}>Evento</Text>
            <Text style={[styles.headerLabelHint, minimal && styles.headerLabelHintMinimal]}>
              {viewMode === 'month' ? 'Colunas: meses' : 'Colunas: dias'}
            </Text>
          </View>

          <ScrollView
            ref={leftScrollRef}
            style={styles.frozenBodyScroll}
            contentContainerStyle={styles.frozenBodyContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            nestedScrollEnabled
            onScroll={(event) => syncVerticalScroll('left', event)}
          >
            {model.rows.map((row, rowIndex) => (
              <TouchableOpacity
                key={row.id}
                style={[
                  styles.labelCell,
                  { height: ROW_HEIGHT, width: labelColumnWidth },
                  rowIndex % 2 === 1 && styles.dataRowAlt,
                  rowIndex % 2 === 1 && minimal && styles.dataRowAltMinimal,
                  minimal && styles.labelCellMinimal,
                ]}
                onPress={() => onEventPress?.(row.id)}
                disabled={!onEventPress}
                activeOpacity={onEventPress ? 0.75 : 1}
              >
                <Text
                  style={[styles.eventNameText, minimal && styles.eventNameTextMinimal]}
                  numberOfLines={EVENT_NAME_MAX_LINES}
                >
                  {row.name}
                </Text>
                {row.localLabel ? (
                  <Text style={[styles.eventMetaText, minimal && styles.eventMetaTextMinimal]} numberOfLines={1}>
                    {row.localLabel}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Área rolável: apenas datas (cabeçalho + células) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={styles.datesHorizontalScroll}
          contentContainerStyle={{ width: datesWidth }}
        >
          <View style={{ width: datesWidth }}>
            <View style={[styles.datesHeaderRow, { height: HEADER_HEIGHT }, minimal && styles.datesHeaderRowMinimal]}>
              {model.dateColumns.map((column) => (
                <View
                  key={column.key}
                  style={[
                    styles.dateHeaderCell,
                    { width: columnWidth },
                    column.isToday && styles.dateHeaderCellToday,
                    minimal && styles.dateHeaderCellMinimal,
                    minimal && column.isToday && styles.dateHeaderCellTodayMinimal,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateHeaderWeekday,
                      column.isToday && styles.dateHeaderTextToday,
                      minimal && styles.dateHeaderWeekdayMinimal,
                      minimal && column.isToday && styles.dateHeaderTextTodayMinimal,
                    ]}
                  >
                    {column.weekdayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.dateHeaderDay,
                      column.isToday && styles.dateHeaderTextToday,
                      minimal && styles.dateHeaderDayMinimal,
                      minimal && column.isToday && styles.dateHeaderTextTodayMinimal,
                    ]}
                  >
                    {column.dayLabel}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView
              ref={rightScrollRef}
              style={styles.datesBodyScroll}
              contentContainerStyle={styles.datesBodyContent}
              showsVerticalScrollIndicator
              scrollEventThrottle={16}
              nestedScrollEnabled
              onScroll={(event) => syncVerticalScroll('right', event)}
            >
              {model.rows.map((row, rowIndex) => (
                <View
                  key={row.id}
                  style={[
                    styles.dataRow,
                    { height: ROW_HEIGHT },
                    rowIndex % 2 === 1 && styles.dataRowAlt,
                    rowIndex % 2 === 1 && minimal && styles.dataRowAltMinimal,
                    minimal && styles.dataRowMinimal,
                  ]}
                >
                  {model.dateColumns.map((column) => {
                    const isScheduled = resolveRowScheduledInColumn(row, column.key);
                    const sameDayEventCount = eventCountByCalendarDate[row.calendarDate] ?? 0;
                    const showSameDayPlus = isScheduled && sameDayEventCount > 1;

                    return (
                      <View
                        key={`${row.id}-${column.key}`}
                        style={[
                          styles.dateCell,
                          { width: columnWidth },
                          column.isToday && styles.dateCellToday,
                          minimal && styles.dateCellMinimal,
                          minimal && column.isToday && styles.dateCellTodayMinimal,
                        ]}
                      >
                        {isScheduled ? (
                          <TouchableOpacity
                            style={[
                              styles.ganttBar,
                              row.isPublished ? styles.ganttBarPublished : styles.ganttBarDraft,
                            ]}
                            onPress={() => onEventPress?.(row.id)}
                            disabled={!onEventPress}
                            activeOpacity={0.85}
                            accessibilityLabel={`${row.name} em ${column.dayLabel}${
                              column.weekdayLabel ? ` ${column.weekdayLabel}` : ''
                            }`}
                          >
                            <View style={styles.ganttBarDotRow}>
                              <View
                                style={[
                                  styles.ganttBarDot,
                                  row.isPublished
                                    ? styles.ganttBarDotPublished
                                    : styles.ganttBarDotDraft,
                                  minimal && styles.ganttBarDotCircle,
                                  minimal && row.isPublished && styles.ganttBarDotPublishedMinimal,
                                  minimal && !row.isPublished && styles.ganttBarDotDraftMinimal,
                                ]}
                              />
                              {showSameDayPlus ? (
                                <Text
                                  style={[
                                    styles.ganttBarDotPlus,
                                    row.isPublished
                                      ? styles.ganttBarDotPlusPublished
                                      : styles.ganttBarDotPlusDraft,
                                    minimal && row.isPublished && styles.ganttBarDotPlusPublishedMinimal,
                                    minimal && !row.isPublished && styles.ganttBarDotPlusDraftMinimal,
                                  ]}
                                >
                                  +
                                </Text>
                              ) : null}
                            </View>
                            {viewMode === 'day' && row.timeLabel ? (
                              <Text
                                style={[
                                  styles.ganttBarTime,
                                  minimal && styles.ganttBarTimeMinimal,
                                  { maxWidth: columnWidth - 4 },
                                ]}
                                numberOfLines={1}
                              >
                                {row.timeLabel}
                              </Text>
                            ) : viewMode === 'month' ? (
                              <Text
                                style={[
                                  styles.ganttBarTime,
                                  minimal && styles.ganttBarTimeMinimal,
                                  { maxWidth: columnWidth - 4 },
                                ]}
                                numberOfLines={1}
                              >
                                {`${row.calendarDate.slice(8, 10)}/${row.calendarDate.slice(5, 7)}`}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.gridLine, minimal && styles.gridLineMinimal]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  hintText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyTitle: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
  headerToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewModeButtonActive: {
    backgroundColor: '#4F46E5',
  },
  viewModeButtonText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    fontWeight: '700',
  },
  viewModeButtonTextActive: {
    color: '#FFFFFF',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendSwatchPublished: {
    backgroundColor: '#10b981',
  },
  legendSwatchDraft: {
    backgroundColor: '#F59E0B',
  },
  legendText: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '600',
  },
  legendMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    paddingHorizontal: 4,
    paddingBottom: 4,
    maxWidth: '100%',
    flexShrink: 1,
  },
  legendHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 4,
    paddingBottom: 10,
    maxWidth: '100%',
    flexShrink: 1,
  },
  gridShell: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  frozenColumn: {
    width: LABEL_COLUMN_WIDTH,
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 0 },
  },
  frozenBodyScroll: {
    maxHeight: BODY_MAX_HEIGHT,
  },
  frozenBodyContent: {
    flexGrow: 1,
  },
  datesHorizontalScroll: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  datesHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
  },
  datesBodyScroll: {
    maxHeight: BODY_MAX_HEIGHT,
  },
  datesBodyContent: {
    flexGrow: 1,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  dataRowAlt: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  labelCell: {
    width: LABEL_COLUMN_WIDTH,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  headerLabelCell: {
    width: LABEL_COLUMN_WIDTH,
    paddingHorizontal: 8,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
  },
  headerLabelText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headerLabelHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  eventNameText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  eventMetaText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    marginTop: 2,
  },
  dateHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#334155',
    backgroundColor: '#FFFFFF',
  },
  dateHeaderCellToday: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  dateHeaderWeekday: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '600',
  },
  dateHeaderDay: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  dateHeaderTextToday: {
    color: '#86EFAC',
  },
  dateCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1e293b',
  },
  dateCellToday: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  gridLine: {
    width: 1,
    height: '60%',
    backgroundColor: '#1e293b',
    opacity: 0.5,
  },
  ganttBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    minHeight: 36,
    width: '100%',
  },
  ganttBarPublished: {},
  ganttBarDraft: {},
  ganttBarDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ganttBarDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  ganttBarDotPlus: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
    marginTop: -1,
  },
  ganttBarDotPlusPublished: {
    color: '#34D399',
  },
  ganttBarDotPlusDraft: {
    color: '#FBBF24',
  },
  ganttBarDotPublished: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  ganttBarDotDraft: {
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  ganttBarTime: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  containerMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  gridShellMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.background,
  },
  headerToolbarMinimal: {
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 0,
  },
  legendRowMinimal: {
    justifyContent: 'center',
    flexGrow: 1,
  },
  legendTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  legendSwatchCircle: {
    borderRadius: 999,
  },
  legendSwatchPublishedMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 0,
  },
  legendSwatchDraftMinimal: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: MINIMAL_UI.blueDark,
  },
  ganttBarDotCircle: {
    borderRadius: 7,
  },
  ganttBarDotPublishedMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  ganttBarDotDraftMinimal: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: MINIMAL_UI.blueDark,
  },
  ganttBarDotPlusPublishedMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  ganttBarDotPlusDraftMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  viewModeToggleMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
  },
  viewModeButtonMinimal: {
    paddingHorizontal: 10,
  },
  viewModeButtonActiveMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  viewModeButtonTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  viewModeButtonTextActiveMinimal: {
    color: MINIMAL_UI.onDark,
  },
  legendMetaMinimal: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  legendHintMinimal: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  hintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  emptyTitleMinimal: {
    color: MINIMAL_UI.text,
  },
  errorTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  retryButtonMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  retryButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  frozenColumnMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderRightColor: MINIMAL_UI.border,
    shadowOpacity: 0.08,
    shadowColor: '#0F172A',
  },
  headerLabelCellMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderBottomColor: MINIMAL_UI.border,
  },
  headerLabelTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  headerLabelHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  labelCellMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  dataRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  dataRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  eventNameTextMinimal: {
    color: MINIMAL_UI.text,
  },
  eventMetaTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  datesHeaderRowMinimal: {
    borderBottomColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  dateHeaderCellMinimal: {
    borderRightColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  dateHeaderCellTodayMinimal: {
    backgroundColor: '#EFF6FF',
  },
  dateHeaderWeekdayMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  dateHeaderDayMinimal: {
    color: MINIMAL_UI.text,
  },
  dateHeaderTextTodayMinimal: {
    color: MINIMAL_UI.accent,
  },
  dateCellMinimal: {
    borderRightColor: MINIMAL_UI.divider,
  },
  dateCellTodayMinimal: {
    backgroundColor: '#F8FAFC',
  },
  gridLineMinimal: {
    backgroundColor: MINIMAL_UI.divider,
    opacity: 1,
  },
  ganttBarTimeMinimal: {
    color: MINIMAL_UI.textMuted,
  },
});
