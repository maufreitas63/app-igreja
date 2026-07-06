import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  showKids?: boolean;
  showTeens?: boolean;
};

/** Selos de salas (ex.: IBN Infantil / IBN Jovens) no modo minimalista. */
export function MinimalRoomSelosRow({ showKids = false, showTeens = false }: Props) {
  const { kidsRoomBadgeLabel, teensRoomBadgeLabel } = useRoomDisplayLabels();

  if (!showKids && !showTeens) {
    return null;
  }

  return (
    <View style={styles.row}>
      {showKids ? (
        <View style={[styles.selo, styles.seloKids]}>
          <View style={[styles.dot, styles.dotKids]} />
          <Text style={styles.seloText} numberOfLines={1}>
            {kidsRoomBadgeLabel}
          </Text>
        </View>
      ) : null}
      {showTeens ? (
        <View style={[styles.selo, styles.seloTeens]}>
          <View style={[styles.dot, styles.dotTeens]} />
          <Text style={styles.seloText} numberOfLines={1}>
            {teensRoomBadgeLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const SELO_WIDTH = 100;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  selo: {
    width: SELO_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: MINIMAL_UI.background,
  },
  seloKids: {
    borderColor: '#FACC15',
  },
  seloTeens: {
    borderColor: '#EF4444',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  dotKids: {
    backgroundColor: '#FACC15',
  },
  dotTeens: {
    backgroundColor: '#EF4444',
  },
  seloText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
  },
});
