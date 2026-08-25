import {
  compareFinancialMonthKeys,
  countFinancialMonthsBetween,
  formatFinancialMonthKey,
  formatFinancialMonthLabel,
  getCalendarMonthKey,
  getNextFinancialMonth,
  getPreviousFinancialMonth,
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
  projectedEntries: number;
  projectedExits: number;
  projectedNetMemberChange: number;
  projectedActiveMembers: number;
};

export type PredictiveHorizonSummary = {
  horizonMonths: PredictiveForecastHorizonMonths;
  totalProjectedRevenue: number;
  averageMonthlyRevenue: number;
  totalProjectedNetMembers: number;
  totalProjectedEntries: number;
  totalProjectedExits: number;
  projectedActiveMembersEnd: number;
  memberGrowthPercent: number;
  averageMonthlyNetMemberChange: number;
  growthAttributedRevenue: number;
  seasonalityAttributedRevenue: number;
};

export type PredictiveInsightsModel = {
  historicalPoints: PredictiveHistoricalPoint[];
  forecasts: Record<PredictiveForecastHorizonMonths, PredictiveForecastPoint[]>;
  horizonSummaries: Record<PredictiveForecastHorizonMonths, PredictiveHorizonSummary>;
  revenuePerNewMemberMonthly: number;
  revenuePerNewMemberHorizon: Record<PredictiveForecastHorizonMonths, number>;
  seasonalityHighlights: { month: number; label: string; factorPercent: number }[];
  modelQuality: {
    revenueRSquared: number;
    growthCorrelation: number;
    memberNetChangeRSquared: number;
    sampleMonths: number;
  };
  calculationBaseMonths: number;
  lastHistoricalMonth: FinancialMonthKey;
  calendarMonth: FinancialMonthKey;
  forecastStartMonth: FinancialMonthKey;
  financialHistoryLagMonths: number;
};

export const PREDICTIVE_FORECAST_MONTHS = 12 as const;

export type PredictiveForecastHorizonMonths = typeof PREDICTIVE_FORECAST_MONTHS;

const FORECAST_HORIZONS = [PREDICTIVE_FORECAST_MONTHS] as const;

export const PREDICTIVE_BASE_MONTHS = 12 as const;

export const PREDICTIVE_DEFAULT_BASE_MONTHS = PREDICTIVE_BASE_MONTHS;

export const PREDICTIVE_MIN_REGRESSION_MONTHS = 8;

export const PREDICTIVE_BASE_CALCULATION_MONTHS = [PREDICTIVE_BASE_MONTHS] as const;

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

type ScalarMonthPoint = {
  timeIndex: number;
  month: number;
  value: number;
};

type ScalarSeasonalRegression = {
  rSquared: number;
  predict: (timeIndex: number, month: number) => number;
};

const buildScalarRegressionPredictions = (
  points: ScalarMonthPoint[],
  predict: (timeIndex: number, month: number) => number
) => points.map((point) => predict(point.timeIndex, point.month));

const computeScalarRSquared = (points: ScalarMonthPoint[], predictions: number[]) => {
  const meanValue = average(points.map((point) => point.value));
  const totalVariance = points.reduce(
    (sum, point) => sum + (point.value - meanValue) ** 2,
    0
  );
  const residualVariance = points.reduce(
    (sum, point, index) => sum + (point.value - predictions[index]) ** 2,
    0
  );

  return totalVariance > 0 ? Math.max(0, 1 - residualVariance / totalVariance) : 0;
};

const fitScalarTrendRegression = (points: ScalarMonthPoint[]) => {
  const featureCount = 2;
  const matrix = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const vector = Array(featureCount).fill(0);

  for (const point of points) {
    const features = [1, point.timeIndex];

    for (let left = 0; left < featureCount; left += 1) {
      vector[left] += features[left] * point.value;

      for (let right = 0; right < featureCount; right += 1) {
        matrix[left][right] += features[left] * features[right];
      }
    }
  }

  const coefficients = solveLinearSystem(matrix, vector);

  if (!coefficients) {
    return null;
  }

  return {
    predict: (timeIndex: number) => coefficients[0] + coefficients[1] * timeIndex,
  };
};

const buildEmpiricalSeasonalFactorsForScalar = (points: ScalarMonthPoint[]) => {
  const monthlyTotals = new Map<number, { sum: number; count: number }>();
  const globalMean = average(points.map((point) => point.value));

  for (const point of points) {
    const bucket = monthlyTotals.get(point.month) ?? { sum: 0, count: 0 };
    bucket.sum += point.value;
    bucket.count += 1;
    monthlyTotals.set(point.month, bucket);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const bucket = monthlyTotals.get(month);

    if (!bucket || bucket.count === 0) {
      return 1;
    }

    const monthMean = bucket.sum / bucket.count;

    if (globalMean === 0) {
      return monthMean === 0 ? 1 : Math.sign(monthMean);
    }

    return monthMean / globalMean;
  });
};

const fitScalarSeasonalRegression = (points: ScalarMonthPoint[]): ScalarSeasonalRegression | null => {
  if (points.length < 3) {
    return null;
  }

  const trend = fitScalarTrendRegression(points);

  if (!trend) {
    const meanValue = average(points.map((point) => point.value));
    const predict = (_timeIndex: number, _month: number) => meanValue;
    const predictions = buildScalarRegressionPredictions(points, predict);

    return {
      rSquared: computeScalarRSquared(points, predictions),
      predict,
    };
  }

  const seasonalFactors = buildEmpiricalSeasonalFactorsForScalar(points);
  const predict = (timeIndex: number, month: number) =>
    trend.predict(timeIndex) * seasonalFactors[month - 1];
  const predictions = buildScalarRegressionPredictions(points, predict);

  return {
    rSquared: computeScalarRSquared(points, predictions),
    predict,
  };
};

const toScalarMonthPoints = (
  points: PredictiveHistoricalPoint[],
  selector: (point: PredictiveHistoricalPoint) => number
): ScalarMonthPoint[] =>
  points.map((point, index) => ({
    timeIndex: index,
    month: point.month.month,
    value: selector(point),
  }));

type SeasonalRegression = {
  coefficients: number[];
  rSquared: number;
  predict: (timeIndex: number, month: number) => number;
};

const buildRegressionPredictions = (
  points: PredictiveHistoricalPoint[],
  predict: (timeIndex: number, month: number) => number
) => points.map((point, index) => predict(index, point.month.month));

const computeRegressionRSquared = (points: PredictiveHistoricalPoint[], predictions: number[]) => {
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

  return totalVariance > 0 ? Math.max(0, 1 - residualVariance / totalVariance) : 0;
};

const fitSimpleTrendRegression = (
  points: PredictiveHistoricalPoint[]
): Pick<SeasonalRegression, 'predict'> | null => {
  const featureCount = 2;
  const matrix = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const vector = Array(featureCount).fill(0);

  for (let index = 0; index < points.length; index += 1) {
    const features = [1, index];

    for (let left = 0; left < featureCount; left += 1) {
      vector[left] += features[left] * points[index].revenue;

      for (let right = 0; right < featureCount; right += 1) {
        matrix[left][right] += features[left] * features[right];
      }
    }
  }

  const coefficients = solveLinearSystem(matrix, vector);

  if (!coefficients) {
    return null;
  }

  return {
    predict: (timeIndex: number) => Math.max(0, coefficients[0] + coefficients[1] * timeIndex),
  };
};

const buildEmpiricalSeasonalFactors = (points: PredictiveHistoricalPoint[]) => {
  const monthlyTotals = new Map<number, { sum: number; count: number }>();
  const globalMean = average(points.map((point) => point.revenue));

  for (const point of points) {
    const bucket = monthlyTotals.get(point.month.month) ?? { sum: 0, count: 0 };
    bucket.sum += point.revenue;
    bucket.count += 1;
    monthlyTotals.set(point.month.month, bucket);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const bucket = monthlyTotals.get(month);

    if (!bucket || bucket.count === 0 || globalMean <= 0) {
      return 1;
    }

    return (bucket.sum / bucket.count) / globalMean;
  });
};

const fitFullDummySeasonalRegression = (
  points: PredictiveHistoricalPoint[]
): SeasonalRegression | null => {
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

  const predict = (timeIndex: number, month: number) => {
    let value = coefficients[0] + coefficients[1] * timeIndex;

    for (let monthIndex = 2; monthIndex <= 12; monthIndex += 1) {
      if (month === monthIndex) {
        value += coefficients[monthIndex];
      }
    }

    return Math.max(0, value);
  };

  const predictions = buildRegressionPredictions(points, predict);

  return {
    coefficients,
    rSquared: computeRegressionRSquared(points, predictions),
    predict,
  };
};

const fitTrendWithEmpiricalSeasonality = (
  points: PredictiveHistoricalPoint[]
): SeasonalRegression | null => {
  const trend = fitSimpleTrendRegression(points);

  if (!trend) {
    return null;
  }

  const seasonalFactors = buildEmpiricalSeasonalFactors(points);
  const predict = (timeIndex: number, month: number) =>
    Math.max(0, trend.predict(timeIndex) * seasonalFactors[month - 1]);
  const predictions = buildRegressionPredictions(points, predict);

  return {
    coefficients: [],
    rSquared: computeRegressionRSquared(points, predictions),
    predict,
  };
};

const fitSeasonalLinearRegression = (
  points: PredictiveHistoricalPoint[]
): SeasonalRegression | null => {
  if (points.length < PREDICTIVE_MIN_REGRESSION_MONTHS) {
    return null;
  }

  if (points.length >= 24) {
    const fullRegression = fitFullDummySeasonalRegression(points);

    if (fullRegression) {
      return fullRegression;
    }
  }

  const empiricalRegression = fitTrendWithEmpiricalSeasonality(points);

  if (empiricalRegression) {
    return empiricalRegression;
  }

  const meanRevenue = average(points.map((point) => point.revenue));
  const predict = (_timeIndex: number, _month: number) => Math.max(0, meanRevenue);
  const predictions = buildRegressionPredictions(points, predict);

  return {
    coefficients: [],
    rSquared: computeRegressionRSquared(points, predictions),
    predict,
  };
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const roundMemberCount = (value: number) => Math.max(0, Math.round(value));

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
    return `Janela de cálculo curta demais (${effectiveWindow} meses). O modelo usa ${PREDICTIVE_BASE_MONTHS} meses passados com receita ordinária; cadastre mais histórico financeiro.`;
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
    .filter((point) => compareFinancialMonthKeys(point.month, endMonth) <= 0)
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

  const avgEntries = average(calculationHistory.map((point) => point.memberEntries));
  const avgExits = average(calculationHistory.map((point) => point.memberExits));
  const memberEntriesRegression =
    fitScalarSeasonalRegression(toScalarMonthPoints(calculationHistory, (point) => point.memberEntries))
    ?? {
      rSquared: 0,
      predict: (_timeIndex: number, _month: number) => avgEntries,
    };
  const memberExitsRegression =
    fitScalarSeasonalRegression(toScalarMonthPoints(calculationHistory, (point) => point.memberExits))
    ?? {
      rSquared: 0,
      predict: (_timeIndex: number, _month: number) => avgExits,
    };
  const reconstructedNetPredictions = calculationHistory.map((point, index) => {
    const entries = roundMemberCount(memberEntriesRegression.predict(index, point.month.month));
    const exits = roundMemberCount(memberExitsRegression.predict(index, point.month.month));
    return entries - exits;
  });
  const memberNetChangeRSquared = computeScalarRSquared(
    toScalarMonthPoints(calculationHistory, (point) => point.netMemberChange),
    reconstructedNetPredictions
  );

  const calendarMemberPoint =
    memberByKey.get(formatFinancialMonthKey(endMonth))
    ?? [...historicalPoints].reverse().find(
      (point) => compareFinancialMonthKeys(point.month, endMonth) <= 0
    )
    ?? calculationHistory[calculationHistory.length - 1];
  const lastActiveMembers = calendarMemberPoint?.activeMembersEnd ?? 0;

  const baselineMonthIndex = calculationHistory.length - 1;
  const baselineMonth = calculationHistory[baselineMonthIndex].month;
  const expectedClosedMonth = getPreviousFinancialMonth(endMonth);
  const financialHistoryLagMonths = Math.max(
    0,
    countFinancialMonthsBetween(baselineMonth, expectedClosedMonth)
  );
  const forecastOriginMonth = endMonth;
  const forecastStartMonth = getNextFinancialMonth(forecastOriginMonth);
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
    let cursorMonth = forecastOriginMonth;
    let activeMembers = lastActiveMembers;
    let totalProjectedRevenue = 0;
    let growthAttributedRevenue = 0;
    let seasonalityAttributedRevenue = 0;
    let totalProjectedNetMembers = 0;
    let totalProjectedEntries = 0;
    let totalProjectedExits = 0;

    for (let step = 1; step <= horizonMonths; step += 1) {
      cursorMonth = getNextFinancialMonth(cursorMonth);
      const timeIndex = baselineMonthIndex + countFinancialMonthsBetween(baselineMonth, cursorMonth);
      const seasonalRevenue = regression.predict(timeIndex, cursorMonth.month);
      const projectedEntries = roundMemberCount(
        memberEntriesRegression.predict(timeIndex, cursorMonth.month)
      );
      const projectedExits = roundMemberCount(
        memberExitsRegression.predict(timeIndex, cursorMonth.month)
      );
      const projectedNetMemberChange = projectedEntries - projectedExits;
      const growthRevenue = revenuePerNewMemberMonthly * projectedNetMemberChange;
      const revenue = Math.max(0, seasonalRevenue + growthRevenue);

      activeMembers = Math.max(0, activeMembers + projectedNetMemberChange);
      totalProjectedRevenue += revenue;
      growthAttributedRevenue += Math.max(0, growthRevenue);
      seasonalityAttributedRevenue += Math.max(0, seasonalRevenue);
      totalProjectedNetMembers += projectedNetMemberChange;
      totalProjectedEntries += projectedEntries;
      totalProjectedExits += projectedExits;

      forecastPoints.push({
        month: cursorMonth,
        revenue,
        revenueFromSeasonality: seasonalRevenue,
        revenueFromGrowth: growthRevenue,
        projectedEntries,
        projectedExits,
        projectedNetMemberChange,
        projectedActiveMembers: activeMembers,
      });
    }

    const memberGrowthPercent =
      lastActiveMembers > 0
        ? ((activeMembers - lastActiveMembers) / lastActiveMembers) * 100
        : totalProjectedNetMembers > 0
          ? 100
          : 0;

    forecasts[horizonMonths] = forecastPoints;
    horizonSummaries[horizonMonths] = {
      horizonMonths,
      totalProjectedRevenue,
      averageMonthlyRevenue: totalProjectedRevenue / horizonMonths,
      totalProjectedNetMembers,
      totalProjectedEntries,
      totalProjectedExits,
      projectedActiveMembersEnd: activeMembers,
      memberGrowthPercent,
      averageMonthlyNetMemberChange: totalProjectedNetMembers / horizonMonths,
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
      memberNetChangeRSquared,
      sampleMonths: calculationHistory.length,
    },
    calculationBaseMonths: calculationHistory.length,
    lastHistoricalMonth: baselineMonth,
    calendarMonth: endMonth,
    forecastStartMonth,
    financialHistoryLagMonths,
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

export const PREDICTIVE_MEMBER_FORMULA_TITLE = 'Fórmula da previsão de membros';

export const buildPredictiveMemberFormulaMessage = (
  horizonMonths: PredictiveForecastHorizonMonths = PREDICTIVE_FORECAST_MONTHS,
  baseCalculationMonths = PREDICTIVE_BASE_MONTHS
) =>
  [
    'Base de dados:',
    '• Entradas: perfis com membership_date no mês.',
    '• Saídas: perfis com membership_out no mês.',
    '• Membros líquidos = entradas − saídas (inteiros por mês; a projeção não usa um terceiro modelo).',
    '• Membros ativos = estoque no fim do mês calendário + líquido projetado mês a mês.',
    `• Janela de treino: últimos ${baseCalculationMonths} meses com receita ordinária (padrão ${PREDICTIVE_BASE_MONTHS}).`,
    '• A previsão começa no mês seguinte ao calendário, mesmo se o financeiro estiver atrasado.',
    '',
    'Modelo mensal (entradas e saídas):',
    'Regressão linear com tendência + fator sazonal por mês do calendário.',
    '',
    `Projeção (${horizonMonths} meses):`,
    '• Cada mês futuro usa a tendência + sazonalidade, com o índice de tempo alinhado ao calendário.',
    '• Crescimento % = (ativos no fim da previsão − ativos hoje) ÷ ativos hoje.',
    '',
    'A receita de crescimento usa o líquido projetado × LTV por novo membro/mês.',
  ].join('\n');

export const buildPredictiveLtvFormulaMessage = (
  horizonMonths: PredictiveForecastHorizonMonths = PREDICTIVE_FORECAST_MONTHS,
  baseCalculationMonths = PREDICTIVE_BASE_MONTHS
) =>
  [
    'Base de dados:',
    '• Receita ordinária realizada (dízimos e ofertas).',
    '• Membros líquidos = entradas − saídas (inteiros) por mês.',
    `• Janela de treino: últimos ${baseCalculationMonths} meses com receita (padrão ${PREDICTIVE_BASE_MONTHS}).`,
    '• A previsão futura começa após o mês calendário, não após o último mês financeiro.',
    '',
    'LTV por novo membro/mês:',
    'Média histórica de (Δ receita no mês seguinte ÷ Δ membros líquidos no mês),',
    'onde Δ receita = receita do mês seguinte − receita do mês atual.',
    '',
    `LTV acumulado (${horizonMonths} meses):`,
    'LTV por novo membro/mês × horizonte de previsão (12 meses).',
    '',
    'Na previsão mensal, a parcela de crescimento usa:',
    'membros líquidos projetados (entradas − saídas) × LTV por novo membro/mês.',
  ].join('\n');

export const describePredictiveForecastAnchor = (model: {
  lastHistoricalMonth: FinancialMonthKey;
  forecastStartMonth: FinancialMonthKey;
}) =>
  `Último mês com receita ordinária: ${formatFinancialMonthLabel(model.lastHistoricalMonth)}. Previsão a partir de ${formatFinancialMonthLabel(model.forecastStartMonth)}.`;

export const describePredictiveBaseWindow = (model: {
  lastHistoricalMonth: FinancialMonthKey;
  calendarMonth: FinancialMonthKey;
  forecastStartMonth: FinancialMonthKey;
  calculationBaseMonths: number;
  financialHistoryLagMonths: number;
}) => {
  const lastLabel = formatFinancialMonthLabel(model.lastHistoricalMonth);
  const startLabel = formatFinancialMonthLabel(model.forecastStartMonth);
  const calendarLabel = formatFinancialMonthLabel(model.calendarMonth);
  const expectedClosed = formatFinancialMonthLabel(getPreviousFinancialMonth(model.calendarMonth));

  if (model.financialHistoryLagMonths <= 0) {
    return `Base: ${model.calculationBaseMonths} meses com receita ordinária até ${lastLabel}. Previsão a partir de ${startLabel}.`;
  }

  return [
    `Último mês com receita ordinária na base: ${lastLabel}.`,
    `O financeiro está atrasado em relação a ${expectedClosed} (${model.financialHistoryLagMonths} mês(es)).`,
    `A previsão começa em ${startLabel} (mês seguinte a ${calendarLabel}), não no mês após ${lastLabel}.`,
    'Importe dízimos/ofertas realizados dos meses faltantes para o modelo treinar com o período atual.',
  ].join(' ');
};
