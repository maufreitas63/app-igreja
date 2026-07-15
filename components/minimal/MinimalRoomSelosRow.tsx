import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  showKids?: boolean;
  showTeens?: boolean;
};

/** Mesmo padrão visual dos chips de sala do editor (ex.: Curso de Batismo). */
const ROOM_CHIP_STYLE = {
  backgroundColor: 'rgba(30, 64, 175, 0.10)',
  borderColor: 'rgba(30, 64, 175, 0.35)',
} as const;

/** Selos de salas (ex.: IBN Infantil / IBN Jovens) no modo minimalista. */
export function MinimalRoomSelosRow({ showKids = false, showTeens = false }: Props) {
  const { kidsRoomBadgeLabel, teensRoomBadgeLabel } = useRoomDisplayLabels();

  if (!showKids && !showTeens) {
    return null;
  }

  return (
    <View style={styles.row}>
      {showKids ? (
        <View style={styles.selo}>
          <Text style={styles.seloText} numberOfLines={1}>
            {kidsRoomBadgeLabel}
          </Text>
        </View>
      ) : null}
      {showTeens ? (
        <View style={styles.selo}>
          <Text style={styles.seloText} numberOfLines={1}>
            {teensRoomBadgeLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: ROOM_CHIP_STYLE.backgroundColor,
    borderColor: ROOM_CHIP_STYLE.borderColor,
    minWidth: 0,
    flexBasis: '48%',
    maxWidth: '100%',
    flexGrow: 1,
    flexShrink: 1,
  },
  seloText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
    textAlign: 'center',
  },
});
