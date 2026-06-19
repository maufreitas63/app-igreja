import { DEFAULT_PALETA_PADRAO } from '@/lib/defaultPalettes';
import { fetchActivePalette, setActivePalette } from '@/lib/paletasApi';
import { mapPaletaToColors, type Paleta, type PaletaColors } from '@/lib/paletasTypes';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type PaletteContextValue = {
  activePalette: Paleta;
  colors: PaletaColors;
  isLoading: boolean;
  error: string | null;
  refreshPalette: () => Promise<void>;
  activatePalette: (options: { paletaId?: string; nome?: string }) => Promise<Paleta>;
};

const PaletteContext = createContext<PaletteContextValue>({
  activePalette: DEFAULT_PALETA_PADRAO,
  colors: mapPaletaToColors(DEFAULT_PALETA_PADRAO),
  isLoading: true,
  error: null,
  refreshPalette: async () => undefined,
  activatePalette: async () => DEFAULT_PALETA_PADRAO,
});

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [activePalette, setActivePaletteState] = useState<Paleta>(DEFAULT_PALETA_PADRAO);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPalette = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const palette = await fetchActivePalette();
      setActivePaletteState(palette);
    } catch (loadError) {
      console.error('Erro ao carregar paleta ativa:', loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a paleta ativa.'
      );
      setActivePaletteState(DEFAULT_PALETA_PADRAO);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activatePalette = useCallback(
    async (options: { paletaId?: string; nome?: string }) => {
      setError(null);

      const updated = options.paletaId
        ? await setActivePalette({ paletaId: options.paletaId })
        : await setActivePalette({ nome: options.nome ?? '' });

      setActivePaletteState(updated);
      return updated;
    },
    []
  );

  useEffect(() => {
    void refreshPalette();
  }, [refreshPalette]);

  const value = useMemo<PaletteContextValue>(
    () => ({
      activePalette,
      colors: mapPaletaToColors(activePalette),
      isLoading,
      error,
      refreshPalette,
      activatePalette,
    }),
    [activatePalette, activePalette, error, isLoading, refreshPalette]
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette(): PaletteContextValue {
  return useContext(PaletteContext);
}
