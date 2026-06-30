import { AgeBracketPieChart, parseAgeBracketChartSlices } from '@/components/AgeBracketPieChart';
import { SupportSuggestionsReportPdfModal } from '@/components/SupportSuggestionsReportPdfModal';
import { SupportSuggestionsReportView } from '@/components/SupportSuggestionsReportView';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
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
} from '@/lib/maintenanceReportFormatting';
import {
  type MaintenanceReportConfigField,
  type MaintenanceReportDefinition,
} from '@/lib/maintenanceReportsCatalog';
import { buildSupportSuggestionsReportPdfObjectUrl } from '@/lib/supportSuggestionsReportPdf';
import type { MaintenanceReportResult } from '@/lib/maintenanceReportsApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
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
};

const ACCENT = '#C084FC';
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
};

function EventDropdown({
  field,
  value,
  disabled,
  events,
  loadingEvents,
  onChange,
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
      <Text style={styles.configLabel}>{field.label}</Text>
      <TouchableOpacity
        style={[styles.dropdownTrigger, disabled && styles.dropdownTriggerDisabled]}
        onPress={() => setOpen((current) => !current)}
        disabled={disabled || loadingEvents}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.dropdownTriggerText} numberOfLines={2}>
          {loadingEvents ? 'Carregando eventos…' : selectedLabel}
        </Text>
        <FontAwesome name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94A3B8" />
      </TouchableOpacity>

      {open ? (
        <View style={styles.dropdownList}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
            {field.optional ? (
              <TouchableOpacity
                style={[styles.dropdownOption, !value && styles.dropdownOptionSelected]}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.dropdownOptionText, !value && styles.dropdownOptionTextSelected]}
                >
                  Automático (próximo culto com inscrições)
                </Text>
              </TouchableOpacity>
            ) : null}

            {sortedEvents.length === 0 ? (
              <Text style={styles.dropdownEmptyText}>Nenhum evento cadastrado.</Text>
            ) : (
              sortedEvents.map((event) => {
                const selected = value === event.id;

                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
                    onPress={() => {
                      onChange(event.id);
                      setOpen(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        selected && styles.dropdownOptionTextSelected,
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
  const { field, value, disabled, onChange } = props;

  if (field.type === 'event') {
    return <EventDropdown {...props} />;
  }

  if (field.type === 'select' && field.options?.length) {
    return (
      <View style={styles.configField}>
        <Text style={styles.configLabel}>{field.label}</Text>
        <View style={styles.selectRow}>
          {field.options.map((option) => {
            const selected = value === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.selectChip, selected && styles.selectChipActive]}
                onPress={() => onChange(option.value)}
                disabled={disabled}
                activeOpacity={0.85}
              >
                <Text style={[styles.selectChipText, selected && styles.selectChipTextActive]}>
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
      <Text style={styles.configLabel}>{field.label}</Text>
      <TextInput
        style={styles.configInput}
        value={value}
        onChangeText={onChange}
        placeholder={field.placeholder}
        placeholderTextColor="#64748B"
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
};

function ReportResultsTable({ result }: ReportResultsTableProps) {
  if (result.reportCode === 'support_suggestions') {
    return <SupportSuggestionsReportView result={result} />;
  }

  return <GenericReportResultsTable result={result} />;
}

function GenericReportResultsTable({ result }: ReportResultsTableProps) {
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
      <Text style={styles.resultsTitle}>
        {result.rows.length.toLocaleString('pt-BR')} registro(s)
      </Text>

      <View style={isAgeBracketReport ? styles.ageBracketResultsRow : undefined}>
        <View style={isAgeBracketReport ? styles.ageBracketTableSection : undefined}>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                {visibleColumns.map((column) => {
                  const align = getReportColumnAlign(column);

                  return (
                    <Text
                      key={column}
                      style={[
                        styles.tableHeaderCell,
                        { width: getReportColumnWidth(column) },
                        align === 'right' && styles.cellAlignRight,
                        align === 'center' && styles.cellAlignCenter,
                      ]}
                    >
                      {formatReportColumnLabel(column)}
                    </Text>
                  );
                })}
              </View>

              {result.rows.slice(0, 100).map((row, rowIndex) => (
                <View
                  key={`row-${rowIndex}`}
                  style={[styles.tableDataRow, rowIndex % 2 === 1 && styles.tableDataRowAlt]}
                >
                  {visibleColumns.map((column) => {
                    const align = getReportColumnAlign(column);
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
                            { width: getReportColumnWidth(column) },
                            align === 'right' && styles.cellAlignRight,
                            align === 'center' && styles.cellAlignCenter,
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
                          <Text style={styles.ageBracketLink} numberOfLines={3}>
                            {formatReportCellValue(column, cellValue)}
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
                            { width: getReportColumnWidth(column) },
                            align === 'right' && styles.cellAlignRight,
                            align === 'center' && styles.cellAlignCenter,
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
                          <Text style={styles.ageBracketLink} numberOfLines={3}>
                            {formatReportCellValue(column, cellValue)}
                          </Text>
                        </Pressable>
                      );
                    }

                    return (
                      <Text
                        key={`${rowIndex}-${column}`}
                        style={[
                          styles.tableDataCell,
                          { width: getReportColumnWidth(column) },
                          align === 'right' && styles.cellAlignRight,
                          align === 'center' && styles.cellAlignCenter,
                          isInactiveMemberName && styles.inactiveMemberName,
                        ]}
                        numberOfLines={3}
                      >
                        {formatReportCellValue(column, cellValue)}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {isAgeBracketReport && ageBracketChartSlices.length > 0 ? (
          <AgeBracketPieChart slices={ageBracketChartSlices} />
        ) : null}
      </View>

      {result.rows.length > 100 ? (
        <Text style={styles.hintText}>Exibindo os primeiros 100 registros.</Text>
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
          <View style={styles.ageBracketBubble}>
            <Text style={styles.ageBracketModalTitle}>{ageBracketModal.faixa}</Text>
            <Text style={styles.ageBracketModalHelp}>
              {ageBracketModal.integrantes.length.toLocaleString('pt-BR')} integrante(s) nesta faixa
              etária.
            </Text>

            <ScrollView
              style={styles.ageBracketMembersScroll}
              contentContainerStyle={styles.ageBracketMembersContent}
              nestedScrollEnabled
            >
              {ageBracketModal.integrantes.length === 0 ? (
                <Text style={styles.hintText}>Nenhum integrante listado para esta faixa.</Text>
              ) : (
                ageBracketModal.integrantes.map((nome, index) => (
                  <Text key={`${nome}-${index}`} style={styles.ageBracketMemberName}>
                    {nome}
                  </Text>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.ageBracketCloseButton}
              onPress={closeAgeBracketModal}
              activeOpacity={0.85}
            >
              <Text style={styles.ageBracketCloseButtonText}>Fechar</Text>
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
          <View style={styles.ageBracketBubble}>
            <Text style={styles.ageBracketModalTitle}>{eventRegistrationsModal.evento}</Text>
            <Text style={styles.ageBracketModalHelp}>
              {eventRegistrationsModal.data} ·{' '}
              {eventRegistrationsModal.participantes.length.toLocaleString('pt-BR')} inscrito(s)
            </Text>

            <ScrollView
              style={styles.ageBracketMembersScroll}
              contentContainerStyle={styles.ageBracketMembersContent}
              nestedScrollEnabled
            >
              {eventRegistrationsModal.participantes.length === 0 ? (
                <Text style={styles.hintText}>Nenhum inscrito listado para este evento.</Text>
              ) : (
                eventRegistrationsModal.participantes.map((participant, index) => (
                  <View key={`${participant.nome}-${index}`} style={styles.eventRegistrationRow}>
                    <Text style={styles.ageBracketMemberName}>{participant.nome}</Text>
                    <Text style={styles.eventRegistrationMeta}>
                      {participant.familia} · {participant.papel}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.ageBracketCloseButton}
              onPress={closeEventRegistrationsModal}
              activeOpacity={0.85}
            >
              <Text style={styles.ageBracketCloseButtonText}>Fechar</Text>
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
};

function ReportSummary({ reportCode, summary, params, events }: ReportSummaryProps) {
  const resolvedEntries = useMemo(
    () => resolveReportSummaryEntries(summary, events, params),
    [events, params, summary]
  );

  if (reportCode === 'parking_estimate') {
    const eventLabel =
      resolveMaintenanceEventLabel(summary.evento, events)
      ?? resolveMaintenanceEventLabel(params.event_id, events);

    return (
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Resumo</Text>
        {eventLabel ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Evento</Text>
            <Text style={styles.summaryCardValue} numberOfLines={2}>
              {eventLabel}
            </Text>
          </View>
        ) : null}
        <View style={styles.summaryRowInline}>
          <View style={[styles.summaryCard, styles.summaryCardInline]}>
            <Text style={styles.summaryCardLabel}>
              {formatReportSummaryLabel('familias_inscritas')}
            </Text>
            <Text style={styles.summaryCardValue}>
              {formatReportSummaryValue('familias_inscritas', summary.familias_inscritas)}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardNarrow]}>
            <Text style={styles.summaryCardLabel}>
              {formatReportSummaryLabel('estimativa_total_veiculos')}
            </Text>
            <Text style={styles.summaryCardValue}>
              {formatReportSummaryValue('estimativa_total_veiculos', summary.estimativa_total_veiculos)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryTitle}>Resumo</Text>
      <View style={styles.summaryGrid}>
        {resolvedEntries.map(([key, value]) => (
          <View key={key} style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>{formatReportSummaryLabel(key)}</Text>
            <Text style={styles.summaryCardValue}>{formatReportSummaryValue(key, value)}</Text>
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
}: ReportSectionProps) {
  return (
    <View style={styles.reportCard}>
      <TouchableOpacity
        style={styles.reportHeader}
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.reportHeaderText}>
          <Text style={styles.reportIndex}>{index + 1}.</Text>
          <Text style={styles.reportTitle}>{definition.title}</Text>
        </View>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#94A3B8"
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.reportBody}>
          {definition.restricted ? (
            <Text
              style={[styles.restrictedBadge, isSuperAdmin && styles.restrictedBadgeAllowed]}
            >
              {isSuperAdmin
                ? 'Dado sensível (LGPD). Acesso liberado como super administrador.'
                : 'Dado sensível (LGPD) — acesso restrito a liderança pastoral ou administrador.'}
            </Text>
          ) : null}

          <Text style={styles.reportDescription}>{definition.description}</Text>

          {definition.configFields.map((field) => (
            <ConfigField
              key={field.key}
              field={field}
              value={params[field.key] ?? field.defaultValue}
              disabled={loading}
              events={events}
              loadingEvents={loadingEvents}
              onChange={(value) => onParamChange(field.key, value)}
            />
          ))}

          <View style={styles.reportActions}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={onReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.resetButtonText}>Restaurar padrões</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.runButton, loading && styles.runButtonDisabled]}
              onPress={() => void onRun()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <Text style={styles.runButtonText}>Gerar relatório</Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? (
            <Text style={styles.errorText}>
              {error.includes('maintenance-reports') ? MAINTENANCE_REPORTS_SQL_HINT : error}
            </Text>
          ) : null}

          {result?.summary && Object.keys(result.summary).length > 0 ? (
            <ReportSummary
              reportCode={definition.code}
              summary={result.summary}
              params={params}
              events={events}
            />
          ) : null}

          {result && result.rows.length > 0 ? <ReportResultsTable result={result} /> : null}

          {result && result.rows.length === 0 && !error ? (
            <Text style={styles.hintText}>Nenhum registro encontrado para os filtros informados.</Text>
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

  const closePdfPreview = useCallback(() => {
    setPdfPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }, []);

  const handleRunReport = useCallback(
    async (definition: MaintenanceReportDefinition) => {
      const result = await runReport(definition);

      if (
        definition.code === 'support_suggestions'
        && result?.success
        && result.rows.length > 0
      ) {
        try {
          const url = await buildSupportSuggestionsReportPdfObjectUrl(result);
          setPdfPreview((current) => {
            if (current?.url) {
              URL.revokeObjectURL(current.url);
            }

            return {
              url,
              count: result.rows.length,
            };
          });
        } catch (pdfError) {
          console.error('Erro ao gerar PDF de sugestões:', pdfError);
        }
      }

      return result;
    },
    [runReport]
  );

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Relatórios</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Catálogo analítico da igreja: membros, finanças, território, eventos, pastoral, voluntários,
        adoção digital e operações. Expanda cada relatório, ajuste os parâmetros e toque em Gerar.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionLabel variant="maintenance">Catálogo ({definitions.length} relatórios)</SectionLabel>

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
          />
        ))}

        {loadingCode ? <CardLoadingState lines={2} compact /> : null}
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
  helpText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
    color: '#F8FAFC',
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
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  reportSources: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  configField: {
    gap: 4,
  },
  configLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  configInput: {
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    color: '#F8FAFC',
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
    color: '#F8FAFC',
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
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  dropdownOptionTextSelected: {
    color: '#F3E8FF',
    fontWeight: '700',
  },
  dropdownEmptyText: {
    color: '#94A3B8',
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
    borderColor: '#475569',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectChipActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(192, 132, 252, 0.18)',
  },
  selectChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  selectChipTextActive: {
    color: '#F3E8FF',
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  resetButton: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetButtonText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  runButton: {
    minWidth: 130,
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
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
  },
  hintText: {
    color: '#94A3B8',
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
    flexGrow: 0,
    flexShrink: 0,
    width: 168,
    maxWidth: '42%',
  },
  summaryCard: {
    minWidth: 132,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  summaryCardLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryCardValue: {
    color: '#F8FAFC',
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
    color: '#94A3B8',
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
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  tableHeaderCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
  },
  tableDataRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  tableDataRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  tableDataCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: '#F8FAFC',
    fontSize: 12,
    lineHeight: 16,
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
    color: '#CBD5E1',
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
    color: '#F8FAFC',
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
    color: '#94A3B8',
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
});
