import {
  buildPredictiveInsightsModel,
  describePredictiveInsightsModelFailure,
  PREDICTIVE_DEFAULT_BASE_MONTHS,
  type PredictiveInsightsModel,
} from '@/lib/financialPredictiveModel';
import {
  fetchPredictiveInsightsSourceData,
  PREDICTIVE_INSIGHTS_SQL_HINT,
} from '@/lib/predictiveInsightsApi';
import { useCallback, useEffect, useState } from 'react';

export { PREDICTIVE_INSIGHTS_SQL_HINT };

type PredictiveSourceData = Awaited<ReturnType<typeof fetchPredictiveInsightsSourceData>>;

const buildModelFromSource = (
  source: PredictiveSourceData,
  baseCalculationMonths: number
): PredictiveInsightsModel | null =>
  buildPredictiveInsightsModel({
    revenueByMonth: source.revenueByMonth,
    memberSeries: source.memberSeries,
    endMonth: source.endMonth,
    baseCalculationMonths,
  });

export function usePredictiveInsights(
  isActive: boolean,
  baseCalculationMonths = PREDICTIVE_DEFAULT_BASE_MONTHS
) {
  const [source, setSource] = useState<PredictiveSourceData | null>(null);
  const [model, setModel] = useState<PredictiveInsightsModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextSource = await fetchPredictiveInsightsSourceData();
      setSource(nextSource);
    } catch (loadError) {
      console.error('Erro ao carregar modelo preditivo:', loadError);
      setSource(null);
      setModel(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o modelo preditivo.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void reload();
  }, [isActive, reload]);

  useEffect(() => {
    if (!source) {
      return;
    }

    const nextModel = buildModelFromSource(source, baseCalculationMonths);

    if (!nextModel) {
      setModel(null);
      setError(
        describePredictiveInsightsModelFailure({
          revenueByMonth: source.revenueByMonth,
          baseCalculationMonths,
        })
      );
      return;
    }

    setModel(nextModel);
    setError(null);
  }, [source, baseCalculationMonths]);

  return {
    model,
    loading,
    error,
    reload,
  };
}
