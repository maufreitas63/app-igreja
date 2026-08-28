import { AgeBracketPieChart, parseAgeBracketChartSlices } from '@/components/AgeBracketPieChart';
import { SupportSuggestionsReportPdfModal } from '@/components/SupportSuggestionsReportPdfModal';
import { SupportSuggestionsReportView } from '@/components/SupportSuggestionsReportView';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { SectionLabel } from '@/components/ui/SectionLabel';
import type { MaintenanceEvent } from '@/hooks/useMaintenanceEvents';
import { useMaintenanceReports } from '@/hooks/useMaintenanceReports';
import { MAINTENANCE_REPORTS_SQL_HINT } from '@/lib/maintenanceReportsApi';
import {
  formatMaintenanceEventOptionLabel,
  formatReportCellValue,
  formatReportColumnLabel,
  formatReportDateTime,
  formatReportSummaryLabel,
  formatReportSummaryValue,
  getReportColumnAlign,
  getReportColumnWidth,
  resolveMaintenanceEventLabel,
  resolveReportSummaryEntries,
  resolveVisibleReportColumns,
  shouldWrapReportCell,
} from '@/lib/maintenanceReportFormatting';
import {
  type MaintenanceReportConfigField,
  type MaintenanceReportDefinition,
} from '@/lib/maintenanceReportsCatalog';
import { buildSupportSuggestionsReportPdfObjectUrl } from '@/lib/supportSuggestionsReportPdf';
import { SUPPORT_SUGGESTIONS_REPORT_PDF_FILENAME } from '@/lib/maintenanceSupportSuggestionsReport';
import type { MaintenanceReportResult } from '@/lib/maintenanceReportsApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  events?: MaintenanceEvent[];
  loadingEvents?: boolean;
  isSuperAdmin?: boolean;
  minimal?: boolean;
};

const ACCENT = '#3A96DD';
const AGE_BRACKET_LINK_COLOR = '#60A5FA';

type AgeBracketMembersModalState = {
  faixa: string;
  integrantes: string[];
};

type EventRegistrationParticipant = {
  familia: string;
  papel: string;
  nome: string;
};

type EventRegistrationsModalState = {
  evento: string;
  data: string;
  participantes: EventRegistrationParticipant[];
};

const parseAgeBracketMembers = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0);
};

const parseEventRegistrationParticipants = (value: unknown): EventRegistrationParticipant[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;

      return {
        familia: String(record.familia ?? '').trim(),
        papel: String(record.papel ?? '').trim(),
        nome: String(record.nome ?? '').trim(),
      };
    })
    .filter(
      (entry): entry is EventRegistrationParticipant =>
        Boolean(entry?.nome)
    );
};

type ConfigFieldProps = {
  field: MaintenanceReportConfigField;
  value: string;
  disabled: boolean;
  events: MaintenanceEvent[];
  loadingEvents: boolean;
  onChange: (value: string) => void;
  minimal?: boolean;
};

function EventDropdown({
  field,
  value,
  disabled,
  events,
  loadingEvents,
  onChange,
  minimal = false,
}: ConfigFieldProps) {
  const [open, setOpen] = useState(false);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((left, right) => {
        const leftTime = left.event_date ? new Date(left.event_date).getTime() : 0;
        const rightTime = right.event_date ? new Date(right.event_date).getTime() : 0;
        return rightTime - leftTime;
      }),
    [events]
  );

  const selectedEvent = sortedEvents.find((event) => event.id === value) ?? null;
  const selectedLabel = selectedEvent
    ? formatMaintenanceEventOptionLabel(selectedEvent.name, selectedEvent.event_date)
    : field.optional
      ? 'Automático (próximo culto com inscrições)'
      : 'Selecione um evento';

  return (
    <View style={styles.configField}>
      <Text style={[styles.configLabel, minimal && styles.configLabelMinimal]}>{field.label}</Text>
      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          minimal && styles.dropdownTriggerMinimal,
          disabled && styles.dropdownTriggerDisabled,
        ]}
        onPress={() => setOpen((current) => !current)}
        disabled={disabled || loadingEvents}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text
          style={[styles.dropdownTriggerText, minimal && styles.dropdownTriggerTextMinimal]}
          numberOfLines={2}
        >
          {loadingEvents ? 'Carregando eventos…' : selectedLabel}
        </Text>
        <FontAwesome
          name={open ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={minimal ? MINIMAL_UI.icon : '#94A3B8'}
        />
      </TouchableOpacity>

      {open ? (
        <View style={[styles.dropdownList, minimal && styles.dropdownListMinimal]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
            {field.optional ? (
              <TouchableOpacity
                style={[
                  styles.dropdownOption,
                  minimal && styles.dropdownOptionMinimal,
                  !value && styles.dropdownOptionSelected,
                  minimal && !value && styles.dropdownOptionSelectedMinimal,
                ]}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    minimal && styles.dropdownOptionTextMinimal,
                    !value && styles.dropdownOptionTextSelected,
                    minimal && !value && styles.dropdownOptionTextSelectedMinimal,
                  ]}
                >
                  Automático (próximo culto com inscrições)
                </Text>
              </TouchableOpacity>
            ) : null}

            {sortedEvents.length === 0 ? (
              <Text style={[styles.dropdownEmptyText, minimal && styles.dropdownEmptyTextMinimal]}>
                Nenhum evento cadastrado.
              </Text>
            ) : (
              sortedEvents.map((event) => {
                const selected = value === event.id;

                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.dropdownOption,
                      minimal && styles.dropdownOptionMinimal,
                      selected && styles.dropdownOptionSelected,
                      minimal && selected && styles.dropdownOptionSelectedMinimal,
                    ]}
                    onPress={() => {
                      onChange(event.id);
                      setOpen(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        minimal && styles.dropdownOptionTextMinimal,
                        selected && styles.dropdownOptionTextSelected,
                        minimal && selected && styles.dropdownOptionTextSelectedMinimal,
                      ]}
                      numberOfLines={2}
                    >
                      {formatMaintenanceEventOptionLabel(event.name, event.event_date)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function ConfigField(props: ConfigFieldProps) {
  const { field, value, disabled, onChange, minimal = false } = props;

  if (field.type === 'event') {
    return <EventDropdown {...props} />;
  }

  if (field.type === 'select' && field.options?.length) {
    return (
      <View style={styles.configField}>
        <Text style={[styles.configLabel, minimal && styles.configLabelMinimal]}>{field.label}</Text>
        <View style={styles.selectRow}>
          {field.options.map((option) => {
            const selected = value === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.selectChip,
                  minimal && styles.selectChipMinimal,
                  selected && styles.selectChipActive,
                  minimal && selected && styles.selectChipActiveMinimal,
                ]}
                onPress={() => onChange(option.value)}
                disabled={disabled}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.selectChipText,
                    minimal && styles.selectChipTextMinimal,
                    selected && styles.selectChipTextActive,
                    minimal && selected && styles.selectChipTextActiveMinimal,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.configField}>
      <Text style={[styles.configLabel, minimal && styles.configLabelMinimal]}>{field.label}</Text>
      <TextInput
        style={[styles.configInput, minimal && styles.configInputMinimal]}
        value={value}
        onChangeText={onChange}
        placeholder={field.placeholder}
        placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

type ReportResultsTableProps = {
  result: NonNullable<ReturnType<typeof useMaintenanceReports>['resultsByCode'][string]>;
  minimal?: boolean;
};

function ReportResultsTable({ result, minimal = false }: ReportResultsTableProps) {
  if (result.reportCode === 'support_suggestions') {
    return <SupportSuggestionsReportView result={result} />;
  }

  return <GenericReportResultsTable result={result} minimal={minimal} />;
}

function GenericReportResultsTable({ result, minimal = false }: ReportResultsTableProps) {
  const [ageBracketModal, setAgeBracketModal] = useState<AgeBracketMembersModalState | null>(null);
  const [eventRegistrationsModal, setEventRegistrationsModal] =
    useState<EventRegistrationsModalState | null>(null);
  const visibleColumns = useMemo(
    () => resolveVisibleReportColumns(result.rows, result.columns),
    [result.columns, result.rows]
  );
  const isAgeBracketReport = result.reportCode === 'demographic_age_brackets';
  const isEventRegistrationsReport = result.reportCode === 'event_registrations';
  const isMembersStatusReport = result.reportCode === 'members_active_inactive';
  const reportCode = result.reportCode;
  const ageBracketChartSlices = useMemo(
    () => (isAgeBracketReport ? parseAgeBracketChartSlices(result.rows) : []),
    [isAgeBracketReport, result.rows]
  );

  if (visibleColumns.length === 0) {
    return null;
  }

  const closeAgeBracketModal = () => {
    setAgeBracketModal(null);
  };

  const closeEventRegistrationsModal = () => {
    setEventRegistrationsModal(null);
  };

  return (
    <>
    <View style={styles.resultsBox}>
      <Text style={[styles.resultsTitle, minimal && styles.resultsTitleMinimal]}>
        {result.rows.length.toLocaleString('pt-BR')} registro(s)
      </Text>

      <View style={isAgeBracketReport ? styles.ageBracketResultsRow : undefined}>
        <View style={isAgeBracketReport ? styles.ageBracketTableSection : undefined}>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
            <View style={[styles.tableContainer, minimal && styles.tableContainerMinimal]}>
              <View style={[styles.tableHeaderRow, minimal && styles.tableHeaderRowMinimal]}>
                {visibleColumns.map((column) => {
                  const align = getReportColumnAlign(column);
                  const columnWidth = getReportColumnWidth(column, reportCode);
                  const wrapEventName = shouldWrapReportCell(column, reportCode);

                  return (
                    <Text
                      key={column}
                      style={[
                        styles.tableHeaderCell,
                        minimal && styles.tableHeaderCellMinimal,
                        { width: columnWidth },
                        isEventRegistrationsReport && styles.tableHeaderCellCompact,
                        align === 'right' && styles.cellAlignRight,
                        align === 'center' && styles.cellAlignCenter,
                      ]}
                    >
                      {formatReportColumnLabel(column)}
                    </Text>
                  );
                })}
              </View>

              {result.rows.slice(0, 100).map((row, rowIndex) => {
                const isAgeMatrixTotalRow =
                  reportCode === 'active_members_age_matrix'
                  && String(row.categoria ?? '').trim() === 'Total';

                return (
                <View
                  key={`row-${rowIndex}`}
                  style={[
                    styles.tableDataRow,
                    minimal && styles.tableDataRowMinimal,
                    rowIndex % 2 === 1 && styles.tableDataRowAlt,
                    minimal && rowIndex % 2 === 1 && styles.tableDataRowAltMinimal,
                    isAgeMatrixTotalRow && styles.tableDataRowTotal,
                    minimal && isAgeMatrixTotalRow && styles.tableDataRowTotalMinimal,
                  ]}
                >
                  {visibleColumns.map((column) => {
                    const align = getReportColumnAlign(column);
                    const columnWidth = getReportColumnWidth(column, reportCode);
                    const wrapEventName = shouldWrapReportCell(column, reportCode);
                    const cellValue = row[column];
                    const isClickableAgeBracket =
                      isAgeBracketReport && column === 'faixa' && typeof cellValue === 'string';
                    const isClickableEvent =
                      isEventRegistrationsReport
                      && column === 'evento'
                      && typeof cellValue === 'string';
                    const isInactiveMemberName =
                      isMembersStatusReport
                      && column === 'nome'
                      && String(row.status ?? '').toLowerCase() === 'inativo';

                    if (isClickableAgeBracket) {
                      const integrantes = parseAgeBracketMembers(row.integrantes);

                      return (
                        <Pressable
                          key={`${rowIndex}-${column}`}
                          style={[
                            styles.tableDataCellPressable,
                            { width: columnWidth },
                            isEventRegistrationsReport && styles.tableDataCellCompact,
                          ]}
                          onPress={() =>
                            setAgeBracketModal({
                              faixa: cellValue,
                              integrantes,
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Ver integrantes da faixa ${cellValue}`}
                        >
                          <Text
                            style={[
                              styles.ageBracketLink,
                              minimal && styles.ageBracketLinkMinimal,
                              align === 'right' && styles.cellAlignRight,
                              align === 'center' && styles.cellAlignCenter,
                            ]}
                            numberOfLines={3}
                          >
                            {formatReportCellValue(column, cellValue, reportCode)}
                          </Text>
                        </Pressable>
                      );
                    }

                    if (isClickableEvent) {
                      const participantes = parseEventRegistrationParticipants(row.participantes);

                      return (
                        <Pressable
                          key={`${rowIndex}-${column}`}
                          style={[
                            styles.tableDataCellPressable,
                            { width: columnWidth },
                            isEventRegistrationsReport && styles.tableDataCellCompact,
                          ]}
                          onPress={() =>
                            setEventRegistrationsModal({
                              evento: cellValue,
                              data: formatReportDateTime(row.data),
                              participantes,
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Ver inscritos do evento ${cellValue}`}
                        >
                          <Text
                            style={[
                              styles.ageBracketLink,
                              minimal && styles.ageBracketLinkMinimal,
                              wrapEventName && styles.tableCellWrap,
                              align === 'right' && styles.cellAlignRight,
                              align === 'center' && styles.cellAlignCenter,
                            ]}
                          >
                            {formatReportCellValue(column, cellValue, reportCode)}
                          </Text>
                        </Pressable>
                      );
                    }

                    return (
                      <Text
                        key={`${rowIndex}-${column}`}
                        style={[
                          styles.tableDataCell,
                          minimal && styles.tableDataCellMinimal,
                          { width: columnWidth },
                          isEventRegistrationsReport && styles.tableDataCellCompact,
                          wrapEventName && styles.tableCellWrap,
                          align === 'right' && styles.cellAlignRight,
                          align === 'center' && styles.cellAlignCenter,
                          isInactiveMemberName && styles.inactiveMemberName,
                        ]}
                        numberOfLines={wrapEventName ? undefined : 3}
                      >
                        {formatReportCellValue(column, cellValue, reportCode)}
                      </Text>
                    );
                  })}
                </View>
              );
              })}
            </View>
          </ScrollView>
        </View>

        {isAgeBracketReport && ageBracketChartSlices.length > 0 ? (
          <AgeBracketPieChart slices={ageBracketChartSlices} />
        ) : null}
      </View>

      {result.rows.length > 100 ? (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Exibindo os primeiros 100 registros.
        </Text>
      ) : null}
    </View>

    <Modal
      visible={ageBracketModal !== null}
      transparent
      animationType="fade"
      onRequestClose={closeAgeBracketModal}
    >
      <View style={styles.ageBracketModalOverlay}>
        <Pressable style={styles.ageBracketModalBackdrop} onPress={closeAgeBracketModal} />

        {ageBracketModal ? (
          <View style={[styles.ageBracketBubble, minimal && styles.ageBracketBubbleMinimal]}>
            <Text style={[styles.ageBracketModalTitle, minimal && styles.ageBracketModalTitleMinimal]}>
              {ageBracketModal.faixa}
            </Text>
            <Text style={[styles.ageBracketModalHelp, minimal && styles.ageBracketModalHelpMinimal]}>
              {ageBracketModal.integrantes.length.toLocaleString('pt-BR')} integrante(s) nesta faixa
              etária.
            </Text>

            <ScrollView
              style={styles.ageBracketMembersScroll}
              contentContainerStyle={styles.ageBracketMembersContent}
              nestedScrollEnabled
            >
              {ageBracketModal.integrantes.length === 0 ? (
                <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
                  Nenhum integrante listado para esta faixa.
                </Text>
              ) : (
                ageBracketModal.integrantes.map((nome, index) => (
                  <Text
                    key={`${nome}-${index}`}
                    style={[styles.ageBracketMemberName, minimal && styles.ageBracketMemberNameMinimal]}
                  >
                    {nome}
                  </Text>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.ageBracketCloseButton, minimal && styles.ageBracketCloseButtonMinimal]}
              onPress={closeAgeBracketModal}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.ageBracketCloseButtonText,
                  minimal && styles.ageBracketCloseButtonTextMinimal,
                ]}
              >
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>

    <Modal
      visible={eventRegistrationsModal !== null}
      transparent
      animationType="fade"
      onRequestClose={closeEventRegistrationsModal}
    >
      <View style={styles.ageBracketModalOverlay}>
        <Pressable
          style={styles.ageBracketModalBackdrop}
          onPress={closeEventRegistrationsModal}
        />

        {eventRegistrationsModal ? (
          <View style={[styles.ageBracketBubble, minimal && styles.ageBracketBubbleMinimal]}>
            <Text style={[styles.ageBracketModalTitle, minimal && styles.ageBracketModalTitleMinimal]}>
              {eventRegistrationsModal.evento}
            </Text>
            <Text style={[styles.ageBracketModalHelp, minimal && styles.ageBracketModalHelpMinimal]}>
              {eventRegistrationsModal.data} ·{' '}
              {eventRegistrationsModal.participantes.length.toLocaleString('pt-BR')} inscrito(s)
            </Text>

            <ScrollView
              style={styles.ageBracketMembersScroll}
              contentContainerStyle={styles.ageBracketMembersContent}
              nestedScrollEnabled
            >
              {eventRegistrationsModal.participantes.length === 0 ? (
                <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
                  Nenhum inscrito listado para este evento.
                </Text>
              ) : (
                eventRegistrationsModal.participantes.map((participant, index) => (
                  <View
                    key={`${participant.nome}-${index}`}
                    style={[styles.eventRegistrationRow, minimal && styles.eventRegistrationRowMinimal]}
                  >
                    <Text
                      style={[
                        styles.ageBracketMemberName,
                        minimal && styles.ageBracketMemberNameMinimal,
                      ]}
                    >
                      {participant.nome}
                    </Text>
                    <Text
                      style={[
                        styles.eventRegistrationMeta,
                        minimal && styles.eventRegistrationMetaMinimal,
                      ]}
                    >
                      {participant.familia} · {participant.papel}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.ageBracketCloseButton, minimal && styles.ageBracketCloseButtonMinimal]}
              onPress={closeEventRegistrationsModal}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.ageBracketCloseButtonText,
                  minimal && styles.ageBracketCloseButtonTextMinimal,
                ]}
              >
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
    </>
  );
}

type ReportSummaryProps = {
  reportCode: string;
  summary: Record<string, unknown>;
  params: Record<string, string>;
  events: MaintenanceEvent[];
  minimal?: boolean;
};

function ReportSummary({ reportCode, summary, params, events, minimal = false }: ReportSummaryProps) {
  const resolvedEntries = useMemo(
    () => resolveReportSummaryEntries(summary, events, params),
    [events, params, summary]
  );

  if (reportCode === 'parking_estimate') {
    const eventLabel =
      resolveMaintenanceEventLabel(summary.evento, events)
      ?? resolveMaintenanceEventLabel(params.event_id, events);

    return (
      <View style={[styles.summaryBox, minimal && styles.summaryBoxMinimal]}>
        <Text style={[styles.summaryTitle, minimal && styles.summaryTitleMinimal]}>Resumo</Text>
        {eventLabel ? (
          <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
            <Text style={[styles.summaryCardLabel, minimal && styles.summaryCardLabelMinimal]}>
              Evento
            </Text>
            <Text
              style={[styles.summaryCardValue, minimal && styles.summaryCardValueMinimal]}
              numberOfLines={2}
            >
              {eventLabel}
            </Text>
          </View>
        ) : null}
        <View style={styles.summaryRowInline}>
          <View
            style={[
              styles.summaryCard,
              minimal && styles.summaryCardMinimal,
              styles.summaryCardInline,
            ]}
          >
            <Text style={[styles.summaryCardLabel, minimal && styles.summaryCardLabelMinimal]}>
              {formatReportSummaryLabel('familias_inscritas')}
            </Text>
            <Text style={[styles.summaryCardValue, minimal && styles.summaryCardValueMinimal]}>
              {formatReportSummaryValue('familias_inscritas', summary.familias_inscritas)}
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              minimal && styles.summaryCardMinimal,
              styles.summaryCardNarrow,
            ]}
          >
            <Text style={[styles.summaryCardLabel, minimal && styles.summaryCardLabelMinimal]}>
              {formatReportSummaryLabel('estimativa_total_veiculos')}
            </Text>
            <Text style={[styles.summaryCardValue, minimal && styles.summaryCardValueMinimal]}>
              {formatReportSummaryValue('estimativa_total_veiculos', summary.estimativa_total_veiculos)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.summaryBox, minimal && styles.summaryBoxMinimal]}>
      <Text style={[styles.summaryTitle, minimal && styles.summaryTitleMinimal]}>Resumo</Text>
      <View style={styles.summaryGrid}>
        {resolvedEntries.map(([key, value]) => (
          <View key={key} style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
            <Text style={[styles.summaryCardLabel, minimal && styles.summaryCardLabelMinimal]}>
              {formatReportSummaryLabel(key)}
            </Text>
            <Text style={[styles.summaryCardValue, minimal && styles.summaryCardValueMinimal]}>
              {formatReportSummaryValue(key, value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type ReportSectionProps = {
  definition: MaintenanceReportDefinition;
  index: number;
  expanded: boolean;
  params: Record<string, string>;
  loading: boolean;
  error: string | null;
  events: MaintenanceEvent[];
  loadingEvents: boolean;
  isSuperAdmin: boolean;
  result: ReturnType<typeof useMaintenanceReports>['resultsByCode'][string] | undefined;
  onToggle: () => void;
  onParamChange: (key: string, value: string) => void;
  onReset: () => void;
  onRun: () => Promise<MaintenanceReportResult | null>;
  onOpenPdf?: () => void;
  pdfLoading?: boolean;
  minimal?: boolean;
};

function ReportSection({
  definition,
  index,
  expanded,
  params,
  loading,
  error,
  events,
  loadingEvents,
  isSuperAdmin,
  result,
  onToggle,
  onParamChange,
  onReset,
  onRun,
  onOpenPdf,
  pdfLoading = false,
  minimal = false,
}: ReportSectionProps) {
  return (
    <View style={[styles.reportCard, minimal && styles.reportCardMinimal]}>
      <TouchableOpacity
        style={styles.reportHeader}
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.reportHeaderText}>
          <Text style={[styles.reportIndex, minimal && styles.reportIndexMinimal]}>
            {index + 1}.
          </Text>
          <Text style={[styles.reportTitle, minimal && styles.reportTitleMinimal]}>
            {definition.title}
          </Text>
        </View>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={minimal ? MINIMAL_UI.icon : '#94A3B8'}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={[styles.reportBody, minimal && styles.reportBodyMinimal]}>
          {definition.restricted ? (
            <Text
              style={[
                styles.restrictedBadge,
                minimal && styles.restrictedBadgeMinimal,
                isSuperAdmin && styles.restrictedBadgeAllowed,
                minimal && isSuperAdmin && styles.restrictedBadgeAllowedMinimal,
              ]}
            >
              {isSuperAdmin
                ? 'Dado sensível (LGPD). Acesso liberado como super administrador.'
                : 'Dado sensível (LGPD) — acesso restrito a liderança pastoral ou administrador.'}
            </Text>
          ) : null}

          <Text style={[styles.reportDescription, minimal && styles.reportDescriptionMinimal]}>
            {definition.description}
          </Text>

          {definition.configFields.map((field) => (
            <ConfigField
              key={field.key}
              field={field}
              value={params[field.key] ?? field.defaultValue}
              disabled={loading}
              events={events}
              loadingEvents={loadingEvents}
              onChange={(value) => onParamChange(field.key, value)}
              minimal={minimal}
            />
          ))}

          <View style={styles.reportActions}>
            <TouchableOpacity
              style={[styles.resetButton, minimal && styles.resetButtonMinimal]}
              onPress={onReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={[styles.resetButtonText, minimal && styles.resetButtonTextMinimal]}>
                Restaurar padrões
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.runButton,
                minimal && styles.runButtonMinimal,
                loading && styles.runButtonDisabled,
              ]}
              onPress={() => void onRun()}
              disabled={loading || pdfLoading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0F172A'} size="small" />
              ) : (
                <Text style={[styles.runButtonText, minimal && styles.runButtonTextMinimal]}>
                  Gerar relatório
                </Text>
              )}
            </TouchableOpacity>
            {definition.code === 'support_suggestions' && result && result.rows.length > 0 ? (
              <TouchableOpacity
                style={[
                  styles.pdfButton,
                  minimal && styles.pdfButtonMinimal,
                  pdfLoading && styles.runButtonDisabled,
                ]}
                onPress={() => onOpenPdf?.()}
                disabled={loading || pdfLoading}
                activeOpacity={0.85}
              >
                {pdfLoading ? (
                  <ActivityIndicator color={minimal ? MINIMAL_UI.blueDark : '#F3E8FF'} size="small" />
                ) : (
                  <Text style={[styles.pdfButtonText, minimal && styles.pdfButtonTextMinimal]}>
                    Abrir PDF
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {error ? (
            <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>
              {error.includes('maintenance-reports') ? MAINTENANCE_REPORTS_SQL_HINT : error}
            </Text>
          ) : null}

          {result?.summary && Object.keys(result.summary).length > 0 ? (
            <ReportSummary
              reportCode={definition.code}
              summary={result.summary}
              params={params}
              events={events}
              minimal={minimal}
            />
          ) : null}

          {result && result.rows.length > 0 ? (
            <ReportResultsTable result={result} minimal={minimal} />
          ) : null}

          {result && result.rows.length === 0 && !error ? (
            <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
              Nenhum registro encontrado para os filtros informados.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function MaintenanceReportsCard({
  panelHeight,
  events = [],
  loadingEvents = false,
  isSuperAdmin = false,
  minimal = false,
}: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const {
    definitions,
    expandedCode,
    toggleExpanded,
    paramsByCode,
    updateParam,
    resetParams,
    loadingCode,
    resultsByCode,
    errorsByCode,
    runReport,
  } = useMaintenanceReports();
  const [pdfPreview, setPdfPreview] = useState<{ url: string; count: number } | null>(null);
  const [pdfLoadingCode, setPdfLoadingCode] = useState<string | null>(null);

  const closePdfPreview = useCallback(() => {
    setPdfPreview((current) => {
      if (current?.url && current.url.startsWith('blob:') && typeof URL !== 'undefined') {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }, []);

  const handleRunReport = useCallback(
    async (definition: MaintenanceReportDefinition) => runReport(definition),
    [runReport]
  );

  const downloadSupportSuggestionsPdf = useCallback((pdfUrl: string) => {
    if (typeof document === 'undefined') {
      void import('@/lib/openPdfUri').then(({ openPdfUri }) => openPdfUri(pdfUrl));
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = pdfUrl;
    anchor.download = SUPPORT_SUGGESTIONS_REPORT_PDF_FILENAME;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

  const handleOpenSupportSuggestionsPdf = useCallback(
    async (definition: MaintenanceReportDefinition) => {
      const result = resultsByCode[definition.code];

      if (!result?.success || result.rows.length === 0) {
        return;
      }

      setPdfLoadingCode(definition.code);

      try {
        const url = await buildSupportSuggestionsReportPdfObjectUrl(result);
        if (typeof document !== 'undefined' && url.startsWith('blob:')) {
          downloadSupportSuggestionsPdf(url);
        }
        setPdfPreview((current) => {
          if (current?.url && current.url.startsWith('blob:') && typeof URL !== 'undefined') {
            URL.revokeObjectURL(current.url);
          }

          return {
            url,
            count: result.rows.length,
          };
        });
      } catch (pdfError) {
        console.error('Erro ao gerar PDF de sugestões:', pdfError);
      } finally {
        setPdfLoadingCode(null);
      }
    },
    [downloadSupportSuggestionsPdf, resultsByCode]
  );

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Relatórios"
        helpText="Catálogo analítico da igreja: membros, finanças, território, eventos, pastoral, voluntários, adoção digital e operações. Expanda cada relatório, ajuste os parâmetros e toque em Gerar."
        minimal={minimal}
        titleStyle={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}
      />

      <ScrollView
        style={[styles.scroll, minimal && styles.scrollMinimal]}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionLabel
          variant="maintenance"
          style={minimal ? styles.sectionLabelMinimal : undefined}
        >
          {`Catálogo (${definitions.length} relatórios)`}
        </SectionLabel>

        {definitions.map((definition, index) => (
          <ReportSection
            key={definition.code}
            definition={definition}
            index={index}
            expanded={expandedCode === definition.code}
            params={paramsByCode[definition.code] ?? {}}
            loading={loadingCode === definition.code}
            error={errorsByCode[definition.code] ?? null}
            events={events}
            loadingEvents={loadingEvents}
            isSuperAdmin={isSuperAdmin}
            result={resultsByCode[definition.code]}
            onToggle={() => toggleExpanded(definition.code)}
            onParamChange={(key, value) => updateParam(definition.code, key, value)}
            onReset={() => resetParams(definition)}
            onRun={() => handleRunReport(definition)}
            onOpenPdf={() => void handleOpenSupportSuggestionsPdf(definition)}
            pdfLoading={pdfLoadingCode === definition.code}
            minimal={minimal}
          />
        ))}

        {loadingCode ? <CardLoadingState lines={2} compact minimal={minimal} /> : null}
      </ScrollView>

      <SupportSuggestionsReportPdfModal
        visible={pdfPreview !== null}
        pdfUrl={pdfPreview?.url ?? null}
        requestCount={pdfPreview?.count ?? 0}
        onClose={closePdfPreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 10,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.28)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reportHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  reportIndex: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  reportTitle: {
    flex: 1,
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  reportBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  restrictedBadge: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  restrictedBadgeAllowed: {
    color: '#86EFAC',
  },
  reportDescription: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  reportSources: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  configField: {
    gap: 4,
  },
  configLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
  },
  configInput: {
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    color: '#3A96DD',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownTrigger: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropdownTriggerDisabled: {
    opacity: 0.7,
  },
  dropdownTriggerText: {
    flex: 1,
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownOption: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(192, 132, 252, 0.16)',
  },
  dropdownOptionText: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  dropdownOptionTextSelected: {
    color: '#F3E8FF',
    fontWeight: '700',
  },
  dropdownEmptyText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    fontStyle: 'italic',
    padding: 10,
  },
  selectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectChip: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectChipActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(192, 132, 252, 0.18)',
  },
  selectChipText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
  },
  selectChipTextActive: {
    color: '#F3E8FF',
  },
  reportActions: {
    ...CONTAIN_WIDTH,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  resetButton: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetButtonText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
  },
  runButton: {
    minWidth: 0,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  runButtonDisabled: {
    opacity: 0.7,
  },
  runButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  pdfButton: {
    minWidth: 0,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.55)',
    backgroundColor: 'rgba(192, 132, 252, 0.14)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pdfButtonText: {
    color: '#F3E8FF',
    fontSize: 12,
    fontWeight: '900',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
  },
  hintText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    padding: 10,
    gap: 8,
  },
  summaryTitle: {
    color: '#E9D5FF',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryRowInline: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  summaryCardInline: {
    flex: 1,
    minWidth: 0,
    flexGrow: 1,
  },
  summaryCardNarrow: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  summaryCard: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  summaryCardLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryCardValue: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  resultsBox: {
    gap: 6,
  },
  ageBracketResultsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ageBracketTableSection: {
    flex: 1,
    minWidth: 0,
  },
  resultsTitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  tableHeaderCellCompact: {
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '800',
  },
  tableDataRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  tableDataRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  tableDataRowTotal: {
    backgroundColor: 'rgba(51, 65, 85, 0.55)',
  },
  tableDataCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  tableDataCellCompact: {
    paddingHorizontal: 6,
  },
  tableCellWrap: {
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  tableDataCellPressable: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  ageBracketLink: {
    color: AGE_BRACKET_LINK_COLOR,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  ageBracketModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
  },
  ageBracketModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  ageBracketBubble: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '78%',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    padding: 14,
    gap: 8,
  },
  ageBracketModalTitle: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '800',
  },
  ageBracketModalHelp: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  ageBracketMembersScroll: {
    maxHeight: 320,
  },
  ageBracketMembersContent: {
    gap: 6,
    paddingBottom: 4,
  },
  ageBracketMemberName: {
    color: '#3A96DD',
    fontSize: 13,
    lineHeight: 18,
  },
  inactiveMemberName: {
    color: '#F87171',
    fontWeight: '700',
  },
  eventRegistrationRow: {
    gap: 2,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  eventRegistrationMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 15,
  },
  ageBracketCloseButton: {
    alignSelf: 'flex-end',
    minWidth: 76,
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: AGE_BRACKET_LINK_COLOR,
  },
  ageBracketCloseButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  cellAlignRight: {
    textAlign: 'right',
  },
  cellAlignCenter: {
    textAlign: 'center',
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 0,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 0,
  },
  sectionLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
  },
  scrollMinimal: {
    ...CONTAIN_WIDTH,
  },
  reportCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  reportIndexMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  reportTitleMinimal: {
    color: MINIMAL_UI.text,
  },
  reportBodyMinimal: {
    borderTopColor: MINIMAL_UI.divider,
  },
  restrictedBadgeMinimal: {
    color: '#DC2626',
  },
  restrictedBadgeAllowedMinimal: {
    color: '#16A34A',
  },
  reportDescriptionMinimal: {
    color: MINIMAL_UI.text,
  },
  configLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
  },
  configInputMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.text,
    borderRadius: 12,
  },
  dropdownTriggerMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  dropdownTriggerTextMinimal: {
    color: MINIMAL_UI.text,
  },
  dropdownListMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  dropdownOptionMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  dropdownOptionSelectedMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  dropdownOptionTextMinimal: {
    color: MINIMAL_UI.text,
  },
  dropdownOptionTextSelectedMinimal: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  dropdownEmptyTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  selectChipMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  selectChipActiveMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: '#EFF6FF',
  },
  selectChipTextMinimal: {
    color: MINIMAL_UI.text,
  },
  selectChipTextActiveMinimal: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
  },
  resetButtonMinimal: {
    borderColor: MINIMAL_UI.blueDark,
  },
  resetButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  runButtonMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  runButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  pdfButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  pdfButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  hintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  summaryBoxMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  summaryTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  summaryCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  summaryCardLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
  },
  summaryCardValueMinimal: {
    color: MINIMAL_UI.text,
  },
  resultsTitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  tableContainerMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  tableHeaderRowMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderBottomColor: MINIMAL_UI.divider,
  },
  tableHeaderCellMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  tableDataRowMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderBottomColor: MINIMAL_UI.divider,
  },
  tableDataRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  tableDataRowTotalMinimal: {
    backgroundColor: '#EFF6FF',
  },
  tableDataCellMinimal: {
    color: MINIMAL_UI.text,
  },
  ageBracketLinkMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  ageBracketBubbleMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  ageBracketModalTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  ageBracketModalHelpMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  ageBracketMemberNameMinimal: {
    color: MINIMAL_UI.text,
  },
  eventRegistrationRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  eventRegistrationMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  ageBracketCloseButtonMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  ageBracketCloseButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
});
