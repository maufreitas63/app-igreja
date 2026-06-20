import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  formatPredictiveCurrency,
  formatPredictiveMonthLabel,
  PREDICTIVE_FORECAST_HORIZONS,
} from '@/lib/financialPredictiveModel';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { usePredictiveInsights } from '@/hooks/usePredictiveInsights';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

const ACCENT = '#22D3EE';

export function MaintenancePredictiveInsightsCard({ isActive = true, panelHeight }: Props) {
  const { model, loading, error, reload } = usePredictiveInsights(isActive);
  const [horizon, setHorizon] = useState<12 | 24 | 36>(12);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const summary = model?.horizonSummaries[horizon] ?? null;
  const forecastPoints = model?.forecasts[horizon] ?? [];

  const recentHistorical = useMemo(
    () => (model ? model.historicalPoints.slice(-6) : []),
    [model]
  );

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Modelo Preditivo</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Previsibilidade de arrecadação ordinária (dízimos e ofertas realizadas) com sazonalidade
        mensal e LTV eclesiástico: correlação entre novos membros líquidos (entrada − desligamento)
        e crescimento de receita nos meses seguintes.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading ? (
        <TouchableOpacity style={styles.reloadButton} onPress={() => void reload()} activeOpacity={0.85}>
          <Text style={styles.reloadButtonText}>Recalcular modelo</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? <CardLoadingState lines={5} /> : null}

      {!loading && model ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel variant="maintenance">Horizonte de previsão</SectionLabel>
          <View style={styles.horizonRow}>
            {PREDICTIVE_FORECAST_HORIZONS.map((option) => {
              const selected = horizon === option;

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.horizonChip, selected && styles.horizonChipSelected]}
                  onPress={() => setHorizon(option)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.horizonChipText, selected && styles.horizonChipTextSelected]}>
                    {option} meses
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {summary ? (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Arrecadação projetada</Text>
                <Text style={styles.summaryValue}>{formatPredictiveCurrency(summary.totalProjectedRevenue)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Média mensal</Text>
                <Text style={styles.summaryValue}>{formatPredictiveCurrency(summary.averageMonthlyRevenue)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Membros líquidos</Text>
                <Text style={styles.summaryValue}>{summary.totalProjectedNetMembers.toFixed(0)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>LTV por novo membro/mês</Text>
                <Text style={styles.summaryValue}>
                  {formatPredictiveCurrency(model.revenuePerNewMemberMonthly)}
                </Text>
              </View>
              <View style={styles.summaryCardWide}>
                <Text style={styles.summaryLabel}>LTV acumulado ({horizon} meses)</Text>
                <Text style={styles.summaryValue}>
                  {formatPredictiveCurrency(model.revenuePerNewMemberHorizon[horizon])}
                </Text>
              </View>
            </View>
          ) : null}

          <SectionLabel variant="maintenance">Sazonalidade detectada</SectionLabel>
          <View style={styles.seasonalityBox}>
            {model.seasonalityHighlights.map((item) => (
              <Text key={item.month} style={styles.seasonalityText}>
                {item.label}: {item.factorPercent >= 0 ? '+' : ''}
                {item.factorPercent.toFixed(1)}% vs. média histórica
              </Text>
            ))}
          </View>

          <SectionLabel variant="maintenance">Qualidade do modelo</SectionLabel>
          <Text style={styles.metaText}>
            R² receita: {(model.modelQuality.revenueRSquared * 100).toFixed(1)}% · Correlação
            crescimento: {(model.modelQuality.growthCorrelation * 100).toFixed(1)}% · Amostra:{' '}
            {model.modelQuality.sampleMonths} meses
          </Text>

          <SectionLabel variant="maintenance">Histórico recente</SectionLabel>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.monthColumn]}>Mês</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Receita</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Líq.</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Ativos</Text>
            </View>
            {recentHistorical.map((point) => (
              <View key={formatPredictiveMonthLabel(point.month)} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.monthColumn]}>
                  {formatPredictiveMonthLabel(point.month)}
                </Text>
                <Text style={styles.tableCell}>{formatPredictiveCurrency(point.revenue)}</Text>
                <Text style={styles.tableCell}>{point.netMemberChange}</Text>
                <Text style={styles.tableCell}>{point.activeMembersEnd}</Text>
              </View>
            ))}
          </View>

          <SectionLabel variant="maintenance">Previsão ({horizon} meses)</SectionLabel>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.monthColumn]}>Mês</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Total</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Sazonal</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Cresc.</Text>
            </View>
            {forecastPoints.map((point) => (
              <View key={formatPredictiveMonthLabel(point.month)} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.monthColumn]}>
                  {formatPredictiveMonthLabel(point.month)}
                </Text>
                <Text style={styles.tableCell}>{formatPredictiveCurrency(point.revenue)}</Text>
                <Text style={styles.tableCell}>
                  {formatPredictiveCurrency(point.revenueFromSeasonality)}
                </Text>
                <Text style={styles.tableCell}>
                  {formatPredictiveCurrency(point.revenueFromGrowth)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 8,
  },
  reloadButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  reloadButtonText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 16,
  },
  horizonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  horizonChip: {
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  horizonChipSelected: {
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
    borderColor: ACCENT,
  },
  horizonChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  horizonChipTextSelected: {
    color: ACCENT,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    width: '48%',
    minWidth: 140,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 10,
    gap: 4,
  },
  summaryCardWide: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 10,
    gap: 4,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  seasonalityBox: {
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 10,
    gap: 4,
  },
  seasonalityText: {
    color: '#E0F2FE',
    fontSize: 12,
    lineHeight: 16,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  tableCell: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  tableHeaderCell: {
    color: '#CBD5E1',
    fontWeight: '800',
  },
  monthColumn: {
    flex: 1.4,
  },
});
