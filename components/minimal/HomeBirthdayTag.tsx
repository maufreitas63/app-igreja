import { INDEX_SHORTCUT_ICON_COLORS } from '@/lib/indexShortcutHints';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  aniversariantes: Array<{ full_name: string }>;
};

/** Bolo à esquerda de «Proximos Eventos»; só renderiza se houver aniversariante hoje. */
export function HomeBirthdayTag({ aniversariantes }: Props) {
  const [open, setOpen] = useState(false);
  const names = aniversariantes.map((item) => item.full_name.trim()).filter(Boolean);

  if (names.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel="Aniversariantes de hoje"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setOpen((current) => !current)}
        style={styles.tip}
      >
        <View style={styles.iconSlot}>
          <FontAwesome
            color={INDEX_SHORTCUT_ICON_COLORS.aniversariantes}
            name="birthday-cake"
            size={16}
          />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Aniversariantes de hoje</Text>
          {names.map((name, index) => (
            <Text key={`${name}-${index}`} style={styles.name}>
              {name}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 8,
    flexShrink: 0,
  },
  tip: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FEF9C3',
  },
  iconSlot: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    left: 44,
    top: 0,
    minWidth: 180,
    maxWidth: 260,
    maxHeight: 220,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    gap: 4,
    zIndex: 12,
    elevation: 12,
  },
  panelTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  name: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '600',
  },
});
