import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { usePalette } from '@/context/PaletteContext';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { fetchAllPalettes } from '@/lib/paletasApi';
import type { Paleta } from '@/lib/paletasTypes';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Painel de paleta — visível somente com evento expandido. */
export function MinimalEventPalettePanel() {
  const { expandedEventId } = useMinimalHome();
  const { activePalette, activatePalette, isLoading: isPaletteLoading } = usePalette();
  const [palettes, setPalettes] = useState<Paleta[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setCatalogLoading(true);

      try {
        const list = await fetchAllPalettes();

        if (!cancelled) {
          setPalettes(list);
        }
      } catch (loadError) {
        console.error('Erro ao carregar paletas:', loadError);
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
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

  const busy = isPaletteLoading || catalogLoading || activating;

  const handlePaletteChange = useCallback(
    async (paletaId: string) => {
      if (paletaId === activePalette.id || activating) {
        return;
      }

      setActivating(true);

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
        setActivating(false);
      }
    },
    [activatePalette, activePalette.id, activating]
  );

  if (!expandedEventId) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.paletteRow}>
        <Text style={styles.paletteLabel}>Paleta</Text>
        {busy && !options.length ? (
          <View style={styles.hiddenIconSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ActivityIndicator color={MINIMAL_UI.blue} size="small" />
          </View>
        ) : (
          <View style={styles.dropdownWrap}>
            <DropdownSelect
              options={options}
              selectedValue={activePalette.id}
              onValueChange={(paletaId) => void handlePaletteChange(paletaId)}
              modalTitle="Selecionar paleta de cores"
              placeholder="Selecionar paleta"
              disabled={busy || !options.length}
              size="compact"
              style={styles.dropdown}
              triggerTextStyle={styles.dropdownText}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.background,
    backgroundColor: MINIMAL_UI.background,
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.background,
  },
  paletteLabel: {
    ...MINIMAL_TYPO.sectionLabel,
    flexShrink: 0,
    color: MINIMAL_UI.blue,
    backgroundColor: MINIMAL_UI.background,
  },
  hiddenIconSlot: {
    width: 0,
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  dropdownWrap: {
    flex: 1,
    minWidth: 0,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.background,
  },
  dropdown: {
    minHeight: 36,
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.background,
  },
  dropdownText: {
    color: MINIMAL_UI.blue,
    fontSize: 13,
    fontWeight: '600',
  },
});
