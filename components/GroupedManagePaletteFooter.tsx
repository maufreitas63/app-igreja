import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { usePalette } from '@/context/PaletteContext';
import { DASHBOARD_CARD_THEMES } from '@/lib/dashboardCardThemes';
import { fetchAllPalettes } from '@/lib/paletasApi';
import type { Paleta } from '@/lib/paletasTypes';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

const THEME = DASHBOARD_CARD_THEMES.grouped_manage;

function PaletteSwatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />;
}

export function GroupedManagePaletteFooter() {
  const { activePalette, activatePalette, isLoading: isActivePaletteLoading } = usePalette();
  const [palettes, setPalettes] = useState<Paleta[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsCatalogLoading(true);

      try {
        const list = await fetchAllPalettes();

        if (!cancelled) {
          setPalettes(list);
        }
      } catch (loadError) {
        console.error('Erro ao carregar paletas:', loadError);
      } finally {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => palettes.map((palette) => ({ value: palette.id, label: palette.nome })),
    [palettes]
  );

  const previewPalette =
    palettes.find((palette) => palette.id === activePalette.id) ?? activePalette;

  const isBusy = isActivePaletteLoading || isCatalogLoading || isActivating;

  const handlePaletteChange = useCallback(
    async (paletaId: string) => {
      if (paletaId === activePalette.id || isActivating) {
        return;
      }

      setIsActivating(true);

      try {
        await activatePalette({ paletaId });
      } catch (activationError) {
        Alert.alert(
          'Paleta de cores',
          activationError instanceof Error
            ? activationError.message
            : 'Não foi possível alterar a paleta de cores.'
        );
      } finally {
        setIsActivating(false);
      }
    },
    [activatePalette, activePalette.id, isActivating]
  );

  return (
    <View style={styles.footer}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Paleta de cores</Text>
        {isBusy ? <ActivityIndicator color={THEME.accentMuted} size="small" /> : null}
      </View>

      {isCatalogLoading && !palettes.length ? (
        <ActivityIndicator color={THEME.accentMuted} style={styles.catalogLoader} />
      ) : (
        <>
          <DropdownSelect
            options={options}
            selectedValue={activePalette.id}
            onValueChange={(paletaId) => void handlePaletteChange(paletaId)}
            modalTitle="Selecionar paleta de cores"
            placeholder="Selecionar paleta"
            disabled={isBusy || !options.length}
            style={styles.dropdown}
          />

          <View style={styles.swatchRow}>
            <PaletteSwatch color={previewPalette.primary_color} />
            <PaletteSwatch color={previewPalette.secondary_color} />
            <PaletteSwatch color={previewPalette.bg_color} />
            <PaletteSwatch color={previewPalette.accent_color} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 'auto',
    width: '100%',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(96, 165, 250, 0.35)',
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: THEME.accentMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  catalogLoader: {
    marginVertical: 8,
  },
  dropdown: {
    width: '100%',
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 250, 252, 0.2)',
  },
});
