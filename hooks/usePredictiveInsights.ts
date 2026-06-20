import {
  buildPredictiveInsightsModel,
  type PredictiveInsightsModel,
} from '@/lib/financialPredictiveModel';
import {
  fetchPredictiveInsightsSourceData,
  PREDICTIVE_INSIGHTS_SQL_HINT,
} from '@/lib/predictiveInsightsApi';
import { useCallback, useEffect, useState } from 'react';

export { PREDICTIVE_INSIGHTS_SQL_HINT };

export function usePredictiveInsights(isActive: boolean) {
  const [model, setModel] = useState<PredictiveInsightsModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const source = await fetchPredictiveInsightsSourceData();
      const nextModel = buildPredictiveInsightsModel({
        revenueByMonth: source.revenueByMonth,
        memberSeries: source.memberSeries,
        endMonth: source.endMonth,
      });

      if (!nextModel) {
        setModel(null);
        setError(
          'Histórico insuficiente para gerar previsões. Cadastre ao menos 6 meses de dízimos/ofertas ordinárias realizadas.'
        );
        return;
      }

      setModel(nextModel);
    } catch (loadError) {
      console.error('Erro ao carregar modelo preditivo:', loadError);
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

  return {
    model,
    loading,
    error,
    reload,
  };
}
