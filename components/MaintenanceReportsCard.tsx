import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceReports } from '@/hooks/useMaintenanceReports';
import { MAINTENANCE_REPORTS_SQL_HINT } from '@/lib/maintenanceReportsApi';
import {
  type MaintenanceReportConfigField,
  type MaintenanceReportDefinition,
} from '@/lib/maintenanceReportsCatalog';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
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
};

const ACCENT = '#C084FC';

const formatSummaryValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }

  return String(value);
};

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

type ConfigFieldProps = {
  field: MaintenanceReportConfigField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

function ConfigField({ field, value, disabled, onChange }: ConfigFieldProps) {
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

type ReportSectionProps = {
  definition: MaintenanceReportDefinition;
  index: number;
  expanded: boolean;
  params: Record<string, string>;
  loading: boolean;
  error: string | null;
  result: ReturnType<typeof useMaintenanceReports>['resultsByCode'][string] | undefined;
  onToggle: () => void;
  onParamChange: (key: string, value: string) => void;
  onReset: () => void;
  onRun: () => void;
};

function ReportSection({
  definition,
  index,
  expanded,
  params,
  loading,
  error,
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
            <Text style={styles.restrictedBadge}>
              Dado sensível (LGPD) — acesso restrito a liderança autorizada.
            </Text>
          ) : null}

          <Text style={styles.reportDescription}>{definition.description}</Text>
          <Text style={styles.reportSources}>Fontes: {definition.dataSources}</Text>

          {definition.configFields.map((field) => (
            <ConfigField
              key={field.key}
              field={field}
              value={params[field.key] ?? field.defaultValue}
              disabled={loading}
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
              onPress={onRun}
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
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Resumo</Text>
              {Object.entries(result.summary).map(([key, value]) => (
                <Text key={key} style={styles.summaryLine}>
                  {key}: {formatSummaryValue(value)}
                </Text>
              ))}
            </View>
          ) : null}

          {result && result.rows.length > 0 ? (
            <View style={styles.resultsBox}>
              <Text style={styles.resultsTitle}>
                {result.rows.length} registro(s)
                {result.generatedAt
                  ? ` — gerado em ${new Date(result.generatedAt).toLocaleString('pt-BR')}`
                  : ''}
              </Text>
              <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeaderRow}>
                    {(result.columns.length > 0
                      ? result.columns
                      : Object.keys(result.rows[0] ?? {})
                    ).map((column) => (
                      <Text key={column} style={styles.tableHeaderCell}>
                        {column}
                      </Text>
                    ))}
                  </View>
                  {result.rows.slice(0, 100).map((row, rowIndex) => {
                    const columns =
                      result.columns.length > 0 ? result.columns : Object.keys(row);

                    return (
                      <View key={`${definition.code}-${rowIndex}`} style={styles.tableDataRow}>
                        {columns.map((column) => (
                          <Text key={`${rowIndex}-${column}`} style={styles.tableDataCell}>
                            {formatCellValue(row[column])}
                          </Text>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
              {result.rows.length > 100 ? (
                <Text style={styles.hintText}>Exibindo os primeiros 100 registros.</Text>
              ) : null}
            </View>
          ) : null}

          {result && result.rows.length === 0 && !error ? (
            <Text style={styles.hintText}>Nenhum registro encontrado para os filtros informados.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function MaintenanceReportsCard({ panelHeight }: Props) {
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

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Relatórios</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Catálogo analítico da igreja: membros, finanças, território, eventos, pastoral, voluntários,
        adoção digital e operações. Expanda cada relatório, ajuste os parâmetros e toque em Gerar.
        Os scripts SQL devem ser aplicados manualmente no Supabase antes do primeiro uso.
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
            result={resultsByCode[definition.code]}
            onToggle={() => toggleExpanded(definition.code)}
            onParamChange={(key, value) => updateParam(definition.code, key, value)}
            onReset={() => resetParams(definition)}
            onRun={() => void runReport(definition)}
          />
        ))}

        {loadingCode ? <CardLoadingState lines={2} compact /> : null}
      </ScrollView>
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
    gap: 4,
  },
  summaryTitle: {
    color: '#E9D5FF',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryLine: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  resultsBox: {
    gap: 6,
  },
  resultsTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  tableHeaderCell: {
    minWidth: 120,
    maxWidth: 180,
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  tableDataCell: {
    minWidth: 120,
    maxWidth: 180,
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: '#F8FAFC',
    fontSize: 11,
    lineHeight: 14,
  },
});
