import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
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
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
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
  minimal?: boolean;
};

const ACCENT = '#3A96DD';

export function MaintenancePredictiveInsightsCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
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

  const sectionLabelStyle = minimal ? styles.sectionLabelMinimal : undefined;

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Modelo Preditivo"
        helpText={`Previsibilidade de arrecadação ordinária e de crescimento de membros com base nos últimos ${PREDICTIVE_BASE_MONTHS} meses e projeção para os próximos ${PREDICTIVE_FORECAST_MONTHS} meses, incluindo sazonalidade mensal e LTV eclesiástico.`}
        minimal={minimal}
        titleStyle={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}
      />

      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {!loading ? (
        <TouchableOpacity
          style={[styles.reloadButton, minimal && styles.reloadButtonMinimal]}
          onPress={() => void reload()}
          activeOpacity={0.85}
        >
          <Text style={[styles.reloadButtonText, minimal && styles.reloadButtonTextMinimal]}>
            Recalcular modelo
          </Text>
        </TouchableOpacity>
      ) : null}

      {loading ? <CardLoadingState lines={5} minimal={minimal} /> : null}

      {!loading && model ? (
        <ScrollView
          style={[styles.scroll, minimal && styles.scrollMinimal]}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel variant="maintenance" style={sectionLabelStyle}>
            Resumo da previsão ({PREDICTIVE_FORECAST_MONTHS} meses)
          </SectionLabel>
          {summary ? (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Membros ativos (fim)
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {summary.projectedActiveMembersEnd.toFixed(0)}
                  </Text>
                </View>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Crescimento de membros
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {summary.memberGrowthPercent >= 0 ? '+' : ''}
                    {summary.memberGrowthPercent.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Entradas projetadas
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {summary.totalProjectedEntries.toFixed(0)}
                  </Text>
                </View>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Saídas projetadas
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {summary.totalProjectedExits.toFixed(0)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Membros líquidos
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {summary.totalProjectedNetMembers.toFixed(0)}
                  </Text>
                </View>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Média líquida/mês
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {summary.averageMonthlyNetMemberChange >= 0 ? '+' : ''}
                    {summary.averageMonthlyNetMemberChange.toFixed(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Arrecadação projetada
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {formatPredictiveCurrency(summary.totalProjectedRevenue)}
                  </Text>
                </View>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    Média mensal
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {formatPredictiveCurrency(summary.averageMonthlyRevenue)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    LTV por novo membro/mês
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {formatPredictiveCurrency(model.revenuePerNewMemberMonthly)}
                  </Text>
                </View>
                <View style={[styles.summaryCard, minimal && styles.summaryCardMinimal]}>
                  <Text style={[styles.summaryLabel, minimal && styles.summaryLabelMinimal]}>
                    LTV acumulado ({PREDICTIVE_FORECAST_MONTHS} meses)
                  </Text>
                  <Text style={[styles.summaryValue, minimal && styles.summaryValueMinimal]}>
                    {formatPredictiveCurrency(model.revenuePerNewMemberHorizon[PREDICTIVE_FORECAST_MONTHS])}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCardRightSlot}>
                  <TouchableOpacity
                    style={[styles.ltvFormulaButton, minimal && styles.ltvFormulaButtonMinimal]}
                    onPress={showMemberFormula}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Ver fórmula de previsão de membros"
                  >
                    <Text
                      style={[styles.ltvFormulaButtonText, minimal && styles.ltvFormulaButtonTextMinimal]}
                      numberOfLines={2}
                    >
                      Fórmula{'\n'}membros
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.summaryCardRightSlot}>
                  <TouchableOpacity
                    style={[styles.ltvFormulaButton, minimal && styles.ltvFormulaButtonMinimal]}
                    onPress={showLtvFormula}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Ver fórmula de cálculo do LTV"
                  >
                    <Text
                      style={[styles.ltvFormulaButtonText, minimal && styles.ltvFormulaButtonTextMinimal]}
                      numberOfLines={2}
                    >
                      Fórmula{'\n'}LTV
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          <SectionLabel variant="maintenance" style={sectionLabelStyle}>
            Sazonalidade detectada
          </SectionLabel>
          <View style={[styles.seasonalityBox, minimal && styles.seasonalityBoxMinimal]}>
            {model.seasonalityHighlights.map((item) => (
              <Text
                key={item.month}
                style={[styles.seasonalityText, minimal && styles.seasonalityTextMinimal]}
              >
                {item.label}: {item.factorPercent >= 0 ? '+' : ''}
                {item.factorPercent.toFixed(1)}% vs. média histórica
              </Text>
            ))}
          </View>

          <SectionLabel variant="maintenance" style={sectionLabelStyle}>
            Qualidade do modelo
          </SectionLabel>
          <Text style={[styles.metaText, minimal && styles.metaTextMinimal]}>
            R² receita: {(model.modelQuality.revenueRSquared * 100).toFixed(1)}% · R² membros
            líquidos: {(model.modelQuality.memberNetChangeRSquared * 100).toFixed(1)}% · Correlação
            crescimento: {(model.modelQuality.growthCorrelation * 100).toFixed(1)}% · Amostra:{' '}
            {model.modelQuality.sampleMonths} meses
          </Text>

          <SectionLabel variant="maintenance" style={sectionLabelStyle}>
            Base de cálculo preditivo
          </SectionLabel>
          <Text style={[styles.metaText, minimal && styles.metaTextMinimal]}>
            Últimos {PREDICTIVE_BASE_MONTHS} meses com receita ordinária para sazonalidade, LTV e
            projeções. Previsão futura: {PREDICTIVE_FORECAST_MONTHS} meses.
          </Text>

          <SectionLabel variant="maintenance" style={sectionLabelStyle}>
            Histórico recente
          </SectionLabel>
          <Text style={[styles.metaText, minimal && styles.metaTextMinimal]}>
            {model.calculationBaseMonths} meses na base de cálculo
            {model.calculationBaseMonths < PREDICTIVE_BASE_MONTHS
              ? ` (apenas ${model.calculationBaseMonths} com receita cadastrada)`
              : ''}
            .
          </Text>
          <View style={[styles.table, minimal && styles.tableMinimal]}>
            <View style={[styles.tableHeaderRow, minimal && styles.tableHeaderRowMinimal]}>
              <Text
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  styles.monthColumn,
                  minimal && styles.tableHeaderCellMinimal,
                ]}
              >
                Mês
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, minimal && styles.tableHeaderCellMinimal]}
              >
                Receita
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, minimal && styles.tableHeaderCellMinimal]}
              >
                Ent
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, minimal && styles.tableHeaderCellMinimal]}
              >
                Sai
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, minimal && styles.tableHeaderCellMinimal]}
              >
                Líq.
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, minimal && styles.tableHeaderCellMinimal]}
              >
                Ativos
              </Text>
            </View>
            {recentHistorical.map((point) => (
              <View
                key={formatPredictiveMonthLabel(point.month)}
                style={[styles.tableRow, minimal && styles.tableRowMinimal]}
              >
                <Text style={[styles.tableCell, styles.monthColumn, minimal && styles.tableCellMinimal]}>
                  {formatPredictiveMonthLabel(point.month)}
                </Text>
                <Text style={[styles.tableCell, minimal && styles.tableCellMinimal]}>
                  {formatPredictiveCurrency(point.revenue)}
                </Text>
                <Text style={[styles.tableCell, minimal && styles.tableCellMinimal]}>
                  {point.memberEntries}
                </Text>
                <Text style={[styles.tableCell, minimal && styles.tableCellMinimal]}>
                  {point.memberExits}
                </Text>
                <Text style={[styles.tableCell, minimal && styles.tableCellMinimal]}>
                  {point.netMemberChange}
                </Text>
                <Text style={[styles.tableCell, minimal && styles.tableCellMinimal]}>
                  {point.activeMembersEnd}
                </Text>
              </View>
            ))}
          </View>

          <SectionLabel variant="maintenance" style={sectionLabelStyle}>
            Previsão de receita ({PREDICTIVE_FORECAST_MONTHS} meses)
          </SectionLabel>
          <View style={[styles.table, minimal && styles.tableMinimal]}>
            <View style={[styles.tableHeaderRow, minimal && styles.tableHeaderRowMinimal]}>
              <Text
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  styles.monthColumn,
                  minimal && styles.tableHeaderCellMinimal,
                ]}
              >
                Mês
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  styles.revenueCompactColumn,
                  minimal && styles.tableHeaderCellMinimal,
                ]}
              >
                Total
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  styles.revenueCompactColumn,
                  minimal && styles.tableHeaderCellMinimal,
                ]}
              >
                Sazonal
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  styles.revenueCompactColumn,
                  minimal && styles.tableHeaderCellMinimal,
                ]}
              >
                Cresc.
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  styles.ativosColumn,
                  minimal && styles.tableHeaderCellMinimal,
                ]}
              >
                Ativos
              </Text>
            </View>
            {forecastPoints.map((point) => (
              <View
                key={formatPredictiveMonthLabel(point.month)}
                style={[styles.tableRow, minimal && styles.tableRowMinimal]}
              >
                <Text style={[styles.tableCell, styles.monthColumn, minimal && styles.tableCellMinimal]}>
                  {formatPredictiveMonthLabel(point.month)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.revenueCompactColumn,
                    minimal && styles.tableCellMinimal,
                  ]}
                >
                  {formatPredictiveCurrency(point.revenue)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.revenueCompactColumn,
                    minimal && styles.tableCellMinimal,
                  ]}
                >
                  {formatPredictiveCurrency(point.revenueFromSeasonality)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.revenueCompactColumn,
                    minimal && styles.tableCellMinimal,
                  ]}
                >
                  {formatPredictiveCurrency(point.revenueFromGrowth)}
                </Text>
                <Text style={[styles.tableCell, styles.ativosColumn, minimal && styles.tableCellMinimal]}>
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
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 8,
  },
  errorTextMinimal: {
    color: '#DC2626',
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
  reloadButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.background,
  },
  reloadButtonText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '800',
  },
  reloadButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollMinimal: {
    ...CONTAIN_WIDTH,
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
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 4,
  },
  summaryCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  summaryCardRightSlot: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 60,
  },
  ltvFormulaButton: {
    width: '100%',
    maxWidth: 118,
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
  ltvFormulaButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
  },
  ltvFormulaButtonText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 14,
  },
  ltvFormulaButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  summaryLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
  },
  summaryValue: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryValueMinimal: {
    color: MINIMAL_UI.text,
  },
  seasonalityBox: {
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 10,
    gap: 4,
  },
  seasonalityBoxMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  seasonalityText: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  seasonalityTextMinimal: {
    color: MINIMAL_UI.text,
  },
  metaText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 15,
  },
  metaTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  table: {
    ...CONTAIN_WIDTH,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  tableHeaderRowMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  tableRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  tableRowMinimal: {
    borderTopColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  tableCell: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: '#3A96DD',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  tableCellMinimal: {
    color: MINIMAL_UI.text,
  },
  tableHeaderCell: {
    color: '#3A96DD',
    fontWeight: '800',
  },
  tableHeaderCellMinimal: {
    color: MINIMAL_UI.blueDark,
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
