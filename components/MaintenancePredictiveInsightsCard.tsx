import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  buildPredictiveLtvFormulaMessage,
  buildPredictiveMemberFormulaMessage,
  formatPredictiveCurrency,
  formatPredictiveMonthLabel,
  PREDICTIVE_BASE_MONTHS,
  PREDICTIVE_FORECAST_MONTHS,
  PREDICTIVE_LTV_FORMULA_TITLE,
  PREDICTIVE_MEMBER_FORMULA_TITLE,
} from '@/lib/financialPredictiveModel';
import { appAlert } from '@/lib/appAlert';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { usePredictiveInsights } from '@/hooks/usePredictiveInsights';
import React, { useMemo } from 'react';
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

const ACCENT = '#3A96DD';

export function MaintenancePredictiveInsightsCard({ isActive = true, panelHeight }: Props) {
  const { model, loading, error, reload } = usePredictiveInsights(isActive, PREDICTIVE_BASE_MONTHS);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const summary = model?.horizonSummaries[PREDICTIVE_FORECAST_MONTHS] ?? null;
  const forecastPoints = model?.forecasts[PREDICTIVE_FORECAST_MONTHS] ?? [];

  const recentHistorical = useMemo(() => {
    if (!model) {
      return [];
    }

    const revenuePoints = model.historicalPoints.filter((point) => point.revenue > 0);
    return revenuePoints.slice(-model.calculationBaseMonths);
  }, [model]);

  const showMemberFormula = () => {
    void appAlert(
      PREDICTIVE_MEMBER_FORMULA_TITLE,
      buildPredictiveMemberFormulaMessage(
        PREDICTIVE_FORECAST_MONTHS,
        model?.calculationBaseMonths ?? PREDICTIVE_BASE_MONTHS
      ),
      'Entendi'
    );
  };

  const showLtvFormula = () => {
    void appAlert(
      PREDICTIVE_LTV_FORMULA_TITLE,
      buildPredictiveLtvFormulaMessage(
        PREDICTIVE_FORECAST_MONTHS,
        model?.calculationBaseMonths ?? PREDICTIVE_BASE_MONTHS
      ),
      'Entendi'
    );
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Modelo Preditivo</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Previsibilidade de arrecadação ordinária e de crescimento de membros com base nos últimos{' '}
        {PREDICTIVE_BASE_MONTHS} meses e projeção para os próximos {PREDICTIVE_FORECAST_MONTHS} meses,
        incluindo sazonalidade mensal e LTV eclesiástico.
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
          <SectionLabel variant="maintenance">Resumo da previsão ({PREDICTIVE_FORECAST_MONTHS} meses)</SectionLabel>
          {summary ? (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Membros ativos (fim)</Text>
                  <Text style={styles.summaryValue}>
                    {summary.projectedActiveMembersEnd.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Crescimento de membros</Text>
                  <Text style={styles.summaryValue}>
                    {summary.memberGrowthPercent >= 0 ? '+' : ''}
                    {summary.memberGrowthPercent.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Entradas projetadas</Text>
                  <Text style={styles.summaryValue}>{summary.totalProjectedEntries.toFixed(0)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Saídas projetadas</Text>
                  <Text style={styles.summaryValue}>{summary.totalProjectedExits.toFixed(0)}</Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Membros líquidos</Text>
                  <Text style={styles.summaryValue}>{summary.totalProjectedNetMembers.toFixed(0)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Média líquida/mês</Text>
                  <Text style={styles.summaryValue}>
                    {summary.averageMonthlyNetMemberChange >= 0 ? '+' : ''}
                    {summary.averageMonthlyNetMemberChange.toFixed(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Arrecadação projetada</Text>
                  <Text style={styles.summaryValue}>{formatPredictiveCurrency(summary.totalProjectedRevenue)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Média mensal</Text>
                  <Text style={styles.summaryValue}>{formatPredictiveCurrency(summary.averageMonthlyRevenue)}</Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>LTV por novo membro/mês</Text>
                  <Text style={styles.summaryValue}>
                    {formatPredictiveCurrency(model.revenuePerNewMemberMonthly)}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>LTV acumulado ({PREDICTIVE_FORECAST_MONTHS} meses)</Text>
                  <Text style={styles.summaryValue}>
                    {formatPredictiveCurrency(model.revenuePerNewMemberHorizon[PREDICTIVE_FORECAST_MONTHS])}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCardRightSlot}>
                  <TouchableOpacity
                    style={styles.ltvFormulaButton}
                    onPress={showMemberFormula}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Ver fórmula de previsão de membros"
                  >
                    <Text style={styles.ltvFormulaButtonText} numberOfLines={2}>
                      Fórmula{'\n'}membros
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.summaryCardRightSlot}>
                  <TouchableOpacity
                    style={styles.ltvFormulaButton}
                    onPress={showLtvFormula}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Ver fórmula de cálculo do LTV"
                  >
                    <Text style={styles.ltvFormulaButtonText} numberOfLines={2}>
                      Fórmula{'\n'}LTV
                    </Text>
                  </TouchableOpacity>
                </View>
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
            R² receita: {(model.modelQuality.revenueRSquared * 100).toFixed(1)}% · R² membros
            líquidos: {(model.modelQuality.memberNetChangeRSquared * 100).toFixed(1)}% · Correlação
            crescimento: {(model.modelQuality.growthCorrelation * 100).toFixed(1)}% · Amostra:{' '}
            {model.modelQuality.sampleMonths} meses
          </Text>

          <SectionLabel variant="maintenance">Base de cálculo preditivo</SectionLabel>
          <Text style={styles.metaText}>
            Últimos {PREDICTIVE_BASE_MONTHS} meses com receita ordinária para sazonalidade, LTV e
            projeções. Previsão futura: {PREDICTIVE_FORECAST_MONTHS} meses.
          </Text>

          <SectionLabel variant="maintenance">Histórico recente</SectionLabel>
          <Text style={styles.metaText}>
            {model.calculationBaseMonths} meses na base de cálculo
            {model.calculationBaseMonths < PREDICTIVE_BASE_MONTHS
              ? ` (apenas ${model.calculationBaseMonths} com receita cadastrada)`
              : ''}
            .
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.monthColumn]}>Mês</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Receita</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Ent</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Sai</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Líq.</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Ativos</Text>
            </View>
            {recentHistorical.map((point) => (
              <View key={formatPredictiveMonthLabel(point.month)} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.monthColumn]}>
                  {formatPredictiveMonthLabel(point.month)}
                </Text>
                <Text style={styles.tableCell}>{formatPredictiveCurrency(point.revenue)}</Text>
                <Text style={styles.tableCell}>{point.memberEntries}</Text>
                <Text style={styles.tableCell}>{point.memberExits}</Text>
                <Text style={styles.tableCell}>{point.netMemberChange}</Text>
                <Text style={styles.tableCell}>{point.activeMembersEnd}</Text>
              </View>
            ))}
          </View>

          <SectionLabel variant="maintenance">
            Previsão de receita ({PREDICTIVE_FORECAST_MONTHS} meses)
          </SectionLabel>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.monthColumn]}>Mês</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.revenueCompactColumn]}>
                Total
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.revenueCompactColumn]}>
                Sazonal
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.revenueCompactColumn]}>
                Cresc.
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.ativosColumn]}>Ativos</Text>
            </View>
            {forecastPoints.map((point) => (
              <View key={formatPredictiveMonthLabel(point.month)} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.monthColumn]}>
                  {formatPredictiveMonthLabel(point.month)}
                </Text>
                <Text style={[styles.tableCell, styles.revenueCompactColumn]}>
                  {formatPredictiveCurrency(point.revenue)}
                </Text>
                <Text style={[styles.tableCell, styles.revenueCompactColumn]}>
                  {formatPredictiveCurrency(point.revenueFromSeasonality)}
                </Text>
                <Text style={[styles.tableCell, styles.revenueCompactColumn]}>
                  {formatPredictiveCurrency(point.revenueFromGrowth)}
                </Text>
                <Text style={[styles.tableCell, styles.ativosColumn]}>
                  {point.projectedActiveMembers.toFixed(0)}
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
    color: 'rgba(58, 150, 221, 0.82)',
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
  summaryGrid: {
    width: '100%',
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    gap: 8,
  },
  summaryCard: {
    width: 'calc(50% - 4px)',
    maxWidth: 'calc(50% - 4px)',
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 4,
  },
  summaryCardRightSlot: {
    width: 'calc(50% - 4px)',
    maxWidth: 'calc(50% - 4px)',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 60,
  },
  ltvFormulaButton: {
    width: 118,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  ltvFormulaButtonText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 14,
  },
  summaryLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#3A96DD',
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
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  metaText: {
    color: 'rgba(58, 150, 221, 0.82)',
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
    color: '#3A96DD',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  tableHeaderCell: {
    color: '#3A96DD',
    fontWeight: '800',
  },
  monthColumn: {
    flex: 1.4,
  },
  revenueCompactColumn: {
    flex: 0.72,
    paddingHorizontal: 4,
  },
  ativosColumn: {
    flex: 0.55,
    paddingHorizontal: 6,
    textAlign: 'right',
  },
});
