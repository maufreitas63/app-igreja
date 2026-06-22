import {
  formatFinancialMonthKey,
  formatFinancialMonthLabel,
  getCalendarMonthKey,
  getNextFinancialMonth,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import type { MemberGrowthMonthPoint } from '@/lib/memberGrowthSeries';

export type PredictiveHistoricalPoint = {
  month: FinancialMonthKey;
  revenue: number;
  memberEntries: number;
  memberExits: number;
  netMemberChange: number;
  activeMembersEnd: number;
};

export type PredictiveForecastPoint = {
  month: FinancialMonthKey;
  revenue: number;
  revenueFromSeasonality: number;
  revenueFromGrowth: number;
  projectedNetMemberChange: number;
  projectedActiveMembers: number;
};

export type PredictiveHorizonSummary = {
  horizonMonths: 12 | 24 | 36;
  totalProjectedRevenue: number;
  averageMonthlyRevenue: number;
  totalProjectedNetMembers: number;
  growthAttributedRevenue: number;
  seasonalityAttributedRevenue: number;
};

export type PredictiveInsightsModel = {
  historicalPoints: PredictiveHistoricalPoint[];
  forecasts: Record<12 | 24 | 36, PredictiveForecastPoint[]>;
  horizonSummaries: Record<12 | 24 | 36, PredictiveHorizonSummary>;
  revenuePerNewMemberMonthly: number;
  revenuePerNewMemberHorizon: Record<12 | 24 | 36, number>;
  seasonalityHighlights: { month: number; label: string; factorPercent: number }[];
  modelQuality: {
    revenueRSquared: number;
    growthCorrelation: number;
    sampleMonths: number;
  };
  calculationBaseMonths: number;
  lastHistoricalMonth: FinancialMonthKey;
};

const FORECAST_HORIZONS = [12, 24, 36] as const;

export const PREDICTIVE_DEFAULT_BASE_MONTHS = 12;

export const PREDICTIVE_MIN_REGRESSION_MONTHS = 8;

export const PREDICTIVE_BASE_CALCULATION_MONTHS = [8, 12, 18, 24, 36] as const;

export type PredictiveBaseCalculationMonths = (typeof PREDICTIVE_BASE_CALCULATION_MONTHS)[number];

const monthLabel = (month: number) =>
  [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ][month - 1] ?? `Mês ${month}`;

const solveLinearSystem = (matrix: number[][], vector: number[]) => {
  const size = vector.length;
  const augmented = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;

    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-9) {
      return null;
    }

    if (maxRow !== pivot) {
      [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];
    }

    const pivotValue = augmented[pivot][pivot];

    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }

      const factor = augmented[row][pivot];

      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[size]);
};

const pearsonCorrelation = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length < 2) {
    return 0;
  }

  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftDenominator = 0;
  let rightDenominator = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftDenominator += leftDelta * leftDelta;
    rightDenominator += rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(leftDenominator * rightDenominator);

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
};

type SeasonalRegression = {
  coefficients: number[];
  rSquared: number;
  predict: (timeIndex: number, month: number) => number;
};

const fitSeasonalLinearRegression = (
  points: PredictiveHistoricalPoint[]
): SeasonalRegression | null => {
  if (points.length < PREDICTIVE_MIN_REGRESSION_MONTHS) {
    return null;
  }

  const featureCount = 13;
  const matrix = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const vector = Array(featureCount).fill(0);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const features = [1, index];

    for (let monthIndex = 2; monthIndex <= 12; monthIndex += 1) {
      features.push(point.month.month === monthIndex ? 1 : 0);
    }

    for (let left = 0; left < featureCount; left += 1) {
      vector[left] += features[left] * point.revenue;

      for (let right = 0; right < featureCount; right += 1) {
        matrix[left][right] += features[left] * features[right];
      }
    }
  }

  const coefficients = solveLinearSystem(matrix, vector);

  if (!coefficients) {
    return null;
  }

  const predictions = points.map((point, index) => {
    let value = coefficients[0] + coefficients[1] * index;

    for (let monthIndex = 2; monthIndex <= 12; monthIndex += 1) {
      if (point.month.month === monthIndex) {
        value += coefficients[monthIndex];
      }
    }

    return value;
  });

  const meanRevenue =
    points.reduce((sum, point) => sum + point.revenue, 0) / Math.max(points.length, 1);
  const totalVariance = points.reduce(
    (sum, point) => sum + (point.revenue - meanRevenue) ** 2,
    0
  );
  const residualVariance = points.reduce(
    (sum, point, index) => sum + (point.revenue - predictions[index]) ** 2,
    0
  );
  const rSquared = totalVariance > 0 ? Math.max(0, 1 - residualVariance / totalVariance) : 0;

  return {
    coefficients,
    rSquared,
    predict: (timeIndex: number, month: number) => {
      let value = coefficients[0] + coefficients[1] * timeIndex;

      for (let monthIndex = 2; monthIndex <= 12; monthIndex += 1) {
        if (month === monthIndex) {
          value += coefficients[monthIndex];
        }
      }

      return Math.max(0, value);
    },
  };
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const countPositiveRevenueMonths = (revenueByMonth: Map<string, number>) =>
  [...revenueByMonth.values()].filter((value) => value > 0).length;

export const describePredictiveInsightsModelFailure = (input: {
  revenueByMonth: Map<string, number>;
  baseCalculationMonths?: number;
}): string => {
  const positiveMonths = countPositiveRevenueMonths(input.revenueByMonth);
  const baseCalculationMonths = Math.max(
    PREDICTIVE_MIN_REGRESSION_MONTHS,
    Math.floor(input.baseCalculationMonths ?? PREDICTIVE_DEFAULT_BASE_MONTHS)
  );
  const effectiveWindow = Math.min(positiveMonths, baseCalculationMonths);

  if (positiveMonths === 0) {
    return [
      'Nenhum mês com receita ordinária de dízimos/ofertas foi encontrado.',
      'Critério: REALIZADO, ENTRADAS, ORDINÁRIO, ministério OFERTAS ou Dízimos.',
      'Se o financeiro já tem histórico, execute scripts/access-control-predictive-insights.sql no Supabase.',
    ].join(' ');
  }

  if (positiveMonths < PREDICTIVE_MIN_REGRESSION_MONTHS) {
    return `Histórico insuficiente: ${positiveMonths} mês(es) com receita ordinária (mínimo ${PREDICTIVE_MIN_REGRESSION_MONTHS}). Cadastre mais meses de dízimos/ofertas realizadas.`;
  }

  if (effectiveWindow < PREDICTIVE_MIN_REGRESSION_MONTHS) {
    return `Janela de cálculo curta demais (${effectiveWindow} meses). Selecione ao menos ${PREDICTIVE_MIN_REGRESSION_MONTHS} meses na base preditiva.`;
  }

  return 'Não foi possível ajustar o modelo sazonal com o histórico disponível. Amplie a base de cálculo ou toque em Recalcular modelo.';
};

export const buildPredictiveInsightsModel = (input: {
  revenueByMonth: Map<string, number>;
  memberSeries: MemberGrowthMonthPoint[];
  endMonth?: FinancialMonthKey;
  baseCalculationMonths?: number;
}): PredictiveInsightsModel | null => {
  const endMonth = input.endMonth ?? getCalendarMonthKey();
  const baseCalculationMonths = Math.max(
    PREDICTIVE_MIN_REGRESSION_MONTHS,
    Math.floor(input.baseCalculationMonths ?? PREDICTIVE_DEFAULT_BASE_MONTHS)
  );
  const memberByKey = new Map(
    input.memberSeries.map((point) => [formatFinancialMonthKey(point.month), point])
  );

  const monthKeys = new Set<string>([
    ...input.revenueByMonth.keys(),
    ...input.memberSeries.map((point) => formatFinancialMonthKey(point.month)),
  ]);

  const historicalPoints = [...monthKeys]
    .map((key) => {
      const [yearText, monthText] = key.split('-');
      const month: FinancialMonthKey = {
        year: Number.parseInt(yearText, 10),
        month: Number.parseInt(monthText, 10),
      };
      const memberPoint = memberByKey.get(key);

      return {
        month,
        revenue: input.revenueByMonth.get(key) ?? 0,
        memberEntries: memberPoint?.entries ?? 0,
        memberExits: memberPoint?.exits ?? 0,
        netMemberChange: memberPoint?.netChange ?? 0,
        activeMembersEnd: memberPoint?.activeMembersEnd ?? 0,
      } satisfies PredictiveHistoricalPoint;
    })
    .filter((point) => Number.isFinite(point.month.year) && Number.isFinite(point.month.month))
    .sort((left, right) => formatFinancialMonthKey(left.month).localeCompare(formatFinancialMonthKey(right.month)));

  const revenueHistory = historicalPoints.filter((point) => point.revenue > 0);

  if (revenueHistory.length < PREDICTIVE_MIN_REGRESSION_MONTHS) {
    return null;
  }

  const calculationHistory = revenueHistory.slice(-baseCalculationMonths);

  if (calculationHistory.length < PREDICTIVE_MIN_REGRESSION_MONTHS) {
    return null;
  }

  const regression = fitSeasonalLinearRegression(calculationHistory);

  if (!regression) {
    return null;
  }

  const growthPairs = calculationHistory
    .slice(0, -1)
    .map((point, index) => ({
      netChange: point.netMemberChange,
      nextRevenueDelta: calculationHistory[index + 1].revenue - point.revenue,
    }))
    .filter((pair) => pair.netChange !== 0 || pair.nextRevenueDelta !== 0);

  const revenuePerNewMemberMonthly =
    growthPairs.length >= 3
      ? average(
          growthPairs.map((pair) =>
            pair.netChange === 0 ? 0 : pair.nextRevenueDelta / pair.netChange
          )
        )
      : 0;

  const growthCorrelation = pearsonCorrelation(
    growthPairs.map((pair) => pair.netChange),
    growthPairs.map((pair) => pair.nextRevenueDelta)
  );

  const avgNetMemberChange = average(calculationHistory.map((point) => point.netMemberChange));
  const lastActiveMembers =
    calculationHistory[calculationHistory.length - 1]?.activeMembersEnd
    ?? historicalPoints[historicalPoints.length - 1]?.activeMembersEnd
    ?? 0;

  const baselineMonthIndex = calculationHistory.length - 1;
  const baselineMonth = calculationHistory[baselineMonthIndex].month;
  const meanRevenue = average(calculationHistory.map((point) => point.revenue));

  const seasonalityHighlights = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const seasonalValue = regression.predict(baselineMonthIndex, month);
    const factorPercent = meanRevenue > 0 ? ((seasonalValue / meanRevenue) - 1) * 100 : 0;

    return {
      month,
      label: monthLabel(month),
      factorPercent,
    };
  })
    .sort((left, right) => right.factorPercent - left.factorPercent)
    .slice(0, 3);

  const forecasts = {} as PredictiveInsightsModel['forecasts'];
  const horizonSummaries = {} as PredictiveInsightsModel['horizonSummaries'];
  const revenuePerNewMemberHorizon = {} as PredictiveInsightsModel['revenuePerNewMemberHorizon'];

  for (const horizonMonths of FORECAST_HORIZONS) {
    const forecastPoints: PredictiveForecastPoint[] = [];
    let cursorMonth = baselineMonth;
    let activeMembers = lastActiveMembers;
    let totalProjectedRevenue = 0;
    let growthAttributedRevenue = 0;
    let seasonalityAttributedRevenue = 0;
    let totalProjectedNetMembers = 0;

    for (let step = 1; step <= horizonMonths; step += 1) {
      cursorMonth = getNextFinancialMonth(cursorMonth);
      const timeIndex = baselineMonthIndex + step;
      const seasonalRevenue = regression.predict(timeIndex, cursorMonth.month);
      const projectedNetMemberChange = avgNetMemberChange;
      const growthRevenue = revenuePerNewMemberMonthly * projectedNetMemberChange;
      const revenue = Math.max(0, seasonalRevenue + growthRevenue);

      activeMembers = Math.max(0, activeMembers + projectedNetMemberChange);
      totalProjectedRevenue += revenue;
      growthAttributedRevenue += Math.max(0, growthRevenue);
      seasonalityAttributedRevenue += Math.max(0, seasonalRevenue);
      totalProjectedNetMembers += projectedNetMemberChange;

      forecastPoints.push({
        month: cursorMonth,
        revenue,
        revenueFromSeasonality: seasonalRevenue,
        revenueFromGrowth: growthRevenue,
        projectedNetMemberChange,
        projectedActiveMembers: activeMembers,
      });
    }

    forecasts[horizonMonths] = forecastPoints;
    horizonSummaries[horizonMonths] = {
      horizonMonths,
      totalProjectedRevenue,
      averageMonthlyRevenue: totalProjectedRevenue / horizonMonths,
      totalProjectedNetMembers,
      growthAttributedRevenue,
      seasonalityAttributedRevenue,
    };
    revenuePerNewMemberHorizon[horizonMonths] =
      revenuePerNewMemberMonthly * horizonMonths;
  }

  return {
    historicalPoints,
    forecasts,
    horizonSummaries,
    revenuePerNewMemberMonthly,
    revenuePerNewMemberHorizon,
    seasonalityHighlights,
    modelQuality: {
      revenueRSquared: regression.rSquared,
      growthCorrelation,
      sampleMonths: calculationHistory.length,
    },
    calculationBaseMonths: calculationHistory.length,
    lastHistoricalMonth: baselineMonth,
  };
};

export const formatPredictiveCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

export const formatPredictiveMonthLabel = (month: FinancialMonthKey) =>
  formatFinancialMonthLabel(month);

export const PREDICTIVE_FORECAST_HORIZONS = FORECAST_HORIZONS;

export const PREDICTIVE_LTV_FORMULA_TITLE = 'Fórmula do LTV eclesiástico';

export const buildPredictiveLtvFormulaMessage = (
  horizonMonths: 12 | 24 | 36,
  baseCalculationMonths = PREDICTIVE_DEFAULT_BASE_MONTHS
) =>
  [
    'Base de dados:',
    '• Receita ordinária realizada (dízimos e ofertas).',
    '• Membros líquidos = entradas (membership_date) − saídas (membership_out) por mês.',
    `• Janela de cálculo: últimos ${baseCalculationMonths} meses com receita.`,
    '',
    'LTV por novo membro/mês:',
    'Média histórica de (Δ receita no mês seguinte ÷ Δ membros líquidos no mês),',
    'onde Δ receita = receita do mês seguinte − receita do mês atual.',
    '',
    `LTV acumulado (${horizonMonths} meses):`,
    'LTV por novo membro/mês × horizonte selecionado.',
    '',
    'Na previsão mensal, a parcela de crescimento usa:',
    'membros líquidos médios históricos × LTV por novo membro/mês.',
  ].join('\n');
