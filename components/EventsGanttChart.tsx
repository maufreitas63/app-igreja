import {
  buildEventsGanttModel,
  type GanttSourceEvent,
  type GanttViewMode,
} from '@/lib/eventsGantt';
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
const DAY_COLUMN_WIDTH = 54;
const MONTH_COLUMN_WIDTH = 68;
const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 46;
const BODY_MAX_HEIGHT = 420;

type EventsGanttChartProps = {
  events: GanttSourceEvent[];
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onEventPress?: (eventId: string) => void;
};

export const EventsGanttChart = ({
  events,
  loading = false,
  error = null,
  onRetry,
  onEventPress,
}: EventsGanttChartProps) => {
  const [viewMode, setViewMode] = useState<GanttViewMode>('day');
  const safeEvents = events ?? [];
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
        <ActivityIndicator color="#818CF8" size="large" />
        <Text style={styles.hintText}>Carregando cronograma…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error.message}</Text>
        {onRetry ? (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Atualizar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!model) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Nenhum evento ativo agendado</Text>
        <Text style={styles.hintText}>
          Cadastre eventos com data de hoje ou futura para visualizar no cronograma (publicados ou
          rascunho).
        </Text>
      </View>
    );
  }

  const resolveRowScheduledInColumn = (row: (typeof model.rows)[number], columnKey: string) =>
    viewMode === 'month' ? row.calendarMonth === columnKey : row.calendarDate === columnKey;

  return (
    <View style={styles.container}>
      <View style={styles.headerToolbar}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchPublished]} />
            <Text style={styles.legendText}>Publicado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchDraft]} />
            <Text style={styles.legendText}>Rascunho</Text>
          </View>
        </View>

        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('day')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'day' }}
          >
            <Text
              style={[styles.viewModeButtonText, viewMode === 'day' && styles.viewModeButtonTextActive]}
            >
              Por dia
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'month' }}
          >
            <Text
              style={[
                styles.viewModeButtonText,
                viewMode === 'month' && styles.viewModeButtonTextActive,
              ]}
            >
              Por mês
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.legendMeta}>
        {model.rows.length} evento{model.rows.length === 1 ? '' : 's'} · {model.dateColumns.length}{' '}
        {model.dateColumns.length === 1 ? periodUnitLabel : periodUnitLabelPlural}
      </Text>
      <Text style={styles.legendHint}>
        Publicado = visível no app dos membros. Rascunho = Publicação desligada ao editar o evento
        (lista de eventos mostra como Inativo).
      </Text>

      <View style={styles.gridShell}>
        {/* Coluna fixa: cabeçalho + nomes dos eventos */}
        <View style={styles.frozenColumn}>
          <View style={[styles.headerLabelCell, { height: HEADER_HEIGHT }]}>
            <Text style={styles.headerLabelText}>Evento</Text>
            <Text style={styles.headerLabelHint}>
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
                  { height: ROW_HEIGHT },
                  rowIndex % 2 === 1 && styles.dataRowAlt,
                ]}
                onPress={() => onEventPress?.(row.id)}
                disabled={!onEventPress}
                activeOpacity={onEventPress ? 0.75 : 1}
              >
                <Text style={styles.eventNameText} numberOfLines={2}>
                  {row.name}
                </Text>
                {row.localLabel ? (
                  <Text style={styles.eventMetaText} numberOfLines={1}>
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
            <View style={[styles.datesHeaderRow, { height: HEADER_HEIGHT }]}>
              {model.dateColumns.map((column) => (
                <View
                  key={column.key}
                  style={[
                    styles.dateHeaderCell,
                    { width: columnWidth },
                    column.isToday && styles.dateHeaderCellToday,
                  ]}
                >
                  <Text
                    style={[styles.dateHeaderWeekday, column.isToday && styles.dateHeaderTextToday]}
                  >
                    {column.weekdayLabel}
                  </Text>
                  <Text style={[styles.dateHeaderDay, column.isToday && styles.dateHeaderTextToday]}>
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
                                ]}
                              />
                              {showSameDayPlus ? (
                                <Text
                                  style={[
                                    styles.ganttBarDotPlus,
                                    row.isPublished
                                      ? styles.ganttBarDotPlusPublished
                                      : styles.ganttBarDotPlusDraft,
                                  ]}
                                >
                                  +
                                </Text>
                              ) : null}
                            </View>
                            {viewMode === 'day' && row.timeLabel ? (
                              <Text
                                style={[styles.ganttBarTime, { maxWidth: columnWidth - 4 }]}
                                numberOfLines={1}
                              >
                                {row.timeLabel}
                              </Text>
                            ) : viewMode === 'month' ? (
                              <Text
                                style={[styles.ganttBarTime, { maxWidth: columnWidth - 4 }]}
                                numberOfLines={1}
                              >
                                {`${row.calendarDate.slice(8, 10)}/${row.calendarDate.slice(5, 7)}`}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.gridLine} />
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
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyTitle: {
    color: '#E2E8F0',
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
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
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
    color: '#94A3B8',
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
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  legendMeta: {
    color: '#64748B',
    fontSize: 11,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  legendHint: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  gridShell: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  frozenColumn: {
    width: LABEL_COLUMN_WIDTH,
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: '#0f172a',
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
  },
  datesHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#0f172a',
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
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLabelText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headerLabelHint: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  eventNameText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  eventMetaText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  dateHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#334155',
    backgroundColor: '#0f172a',
  },
  dateHeaderCellToday: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  dateHeaderWeekday: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  dateHeaderDay: {
    color: '#E2E8F0',
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
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
});
