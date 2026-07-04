import { applyPaletteDocumentTheme } from '@/lib/applyPaletteDocumentTheme';
import { DEFAULT_PALETA_PADRAO } from '@/lib/defaultPalettes';
import { fetchActivePalette, fetchAllPalettes, setActivePalette } from '@/lib/paletasApi';
import { mapPaletaToColors, type Paleta, type PaletaColors } from '@/lib/paletasTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** Preferência local da paleta ativa (persiste entre sessões). */
export const ACTIVE_PALETTE_PREFERENCE_KEY = 'app_active_palette_id';

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

const persistPalettePreference = async (paletteId: string) => {
  try {
    await AsyncStorage.setItem(ACTIVE_PALETTE_PREFERENCE_KEY, paletteId);
  } catch (error) {
    console.warn('Não foi possível salvar preferência de paleta:', error);
  }
};

const readPalettePreference = async () => {
  try {
    return await AsyncStorage.getItem(ACTIVE_PALETTE_PREFERENCE_KEY);
  } catch {
    return null;
  }
};

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [activePalette, setActivePaletteState] = useState<Paleta>(DEFAULT_PALETA_PADRAO);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyActivePalette = useCallback((palette: Paleta) => {
    setActivePaletteState(palette);
    applyPaletteDocumentTheme(mapPaletaToColors(palette), palette.nome);
  }, []);

  const refreshPalette = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [preferredId, catalog, remoteActive] = await Promise.all([
        readPalettePreference(),
        fetchAllPalettes(),
        fetchActivePalette(),
      ]);

      const preferred =
        preferredId
          ? catalog.find((palette) => palette.id === preferredId)
            ?? catalog.find(
              (palette) => palette.nome.trim().toLowerCase() === preferredId.trim().toLowerCase()
            )
          : null;

      applyActivePalette(preferred ?? remoteActive);
    } catch (loadError) {
      console.error('Erro ao carregar paleta ativa:', loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a paleta ativa.'
      );
      applyActivePalette(DEFAULT_PALETA_PADRAO);
    } finally {
      setIsLoading(false);
    }
  }, [applyActivePalette]);

  const activatePalette = useCallback(
    async (options: { paletaId?: string; nome?: string }) => {
      setError(null);

      try {
        const updated = options.paletaId
          ? await setActivePalette({ paletaId: options.paletaId })
          : await setActivePalette({ nome: options.nome ?? '' });

        applyActivePalette(updated);
        await persistPalettePreference(updated.id);
        return updated;
      } catch (activationError) {
        const catalog = await fetchAllPalettes();
        const fallback = options.paletaId
          ? catalog.find((palette) => palette.id === options.paletaId)
          : catalog.find(
              (palette) =>
                palette.nome.trim().toLowerCase() === (options.nome ?? '').trim().toLowerCase()
            );

        if (fallback) {
          const activated = { ...fallback, is_active: true };
          applyActivePalette(activated);
          await persistPalettePreference(activated.id);
          return activated;
        }

        throw activationError;
      }
    },
    [applyActivePalette]
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
