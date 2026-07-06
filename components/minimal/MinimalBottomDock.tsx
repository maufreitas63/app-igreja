import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { ParticipantCupBadge } from '@/components/minimal/ParticipantCupBadge';
import { useAppDrawer } from '@/context/AppDrawerContext';
import { usePalette } from '@/context/PaletteContext';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { fetchAllPalettes } from '@/lib/paletasApi';
import type { Paleta } from '@/lib/paletasTypes';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MinimalBottomDock() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAppDrawer();
  const { activePalette, activatePalette, isLoading: isPaletteLoading } = usePalette();
  const { events } = useActiveEvents({ enablePolling: true });
  const [palettes, setPalettes] = useState<Paleta[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  const participantCount = useMemo(
    () => events.reduce((sum, event) => sum + event.registeredCount, 0),
    [events]
  );

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

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Pressable
        accessibilityLabel="Abrir menu"
        accessibilityRole="button"
        onPress={openDrawer}
        style={styles.menuButton}
      >
        <FontAwesome name="bars" size={MINIMAL_ICON.menu} color={MINIMAL_UI.icon} />
      </Pressable>

      <View style={styles.paletteSection}>
        <Text style={styles.paletteLabel}>Paleta</Text>
        {busy && !options.length ? (
          <ActivityIndicator color={MINIMAL_UI.icon} size="small" />
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
        <ParticipantCupBadge count={participantCount} size="sm" style={styles.cup} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: MINIMAL_UI.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    zIndex: 20,
  },
  menuButton: {
    padding: 8,
  },
  paletteSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  paletteLabel: {
    ...MINIMAL_TYPO.sectionLabel,
    flexShrink: 0,
  },
  dropdownWrap: {
    flex: 1,
    minWidth: 0,
  },
  dropdown: {
    minHeight: 36,
  },
  dropdownText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '600',
  },
  cup: {
    flexShrink: 0,
  },
});
