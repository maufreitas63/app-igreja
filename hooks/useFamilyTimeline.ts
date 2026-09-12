import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchFamilyTimelineFeatureState,
  getFamilyTimeline,
  searchFamilyTimeline,
  setFamilyTimelineFeature,
  type FamilyTimelinePayload,
  type FamilyTimelineSearchHit,
} from '@/lib/familyTimelineApi';

export function useFamilyTimeline(isActive: boolean) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<FamilyTimelineSearchHit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<FamilyTimelinePayload | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [canToggle, setCanToggle] = useState(false);
  const [toggling, setToggling] = useState(false);
  const searchGen = useRef(0);

  const refreshState = useCallback(async () => {
    try {
      const state = await fetchFamilyTimelineFeatureState();
      setEnabled(state.enabled);
      setCanToggle(state.canToggle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler o recurso.');
    }
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const gen = ++searchGen.current;
    if (text.trim().length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const rows = await searchFamilyTimeline(text);
      if (gen !== searchGen.current) return;
      setHits(rows);
    } catch (err) {
      if (gen !== searchGen.current) return;
      setHits([]);
      setError(err instanceof Error ? err.message : 'Busca indisponível.');
    } finally {
      if (gen === searchGen.current) {
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void refreshState();
  }, [isActive, refreshState]);

  useEffect(() => {
    if (!isActive) return;
    const handle = setTimeout(() => {
      void runSearch(query);
    }, query.trim().length >= 2 ? 280 : 0);
    return () => clearTimeout(handle);
  }, [isActive, query, runSearch]);

  const selectFamily = useCallback(async (familyId: string) => {
    setSelectedId(familyId);
    setLoadingTimeline(true);
    setError(null);
    try {
      const next = await getFamilyTimeline(familyId);
      setTimeline(next);
      setEnabled(next.enabled);
      setCanToggle(next.canToggle);
    } catch (err) {
      setTimeline(null);
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a família.');
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    searchGen.current += 1;
    setQuery('');
    setHits([]);
    setSelectedId(null);
    setTimeline(null);
    setSearching(false);
    setLoadingTimeline(false);
    setError(null);
  }, []);

  const toggleFeature = useCallback(async (nextEnabled: boolean) => {
    setToggling(true);
    setError(null);
    try {
      const result = await setFamilyTimelineFeature(nextEnabled);
      if (!result.success) {
        setError(result.message);
        return result;
      }
      setEnabled(result.enabled);
      if (!result.enabled) {
        setHits([]);
        setSelectedId(null);
        setTimeline(null);
        setQuery('');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível alterar o recurso.';
      setError(message);
      return { success: false, message, enabled };
    } finally {
      setToggling(false);
    }
  }, [enabled]);

  return {
    query,
    setQuery,
    searching,
    hits,
    selectedId,
    timeline,
    loadingTimeline,
    error,
    enabled,
    canToggle,
    toggling,
    selectFamily,
    toggleFeature,
    refreshState,
    clearSearch,
  };
}
