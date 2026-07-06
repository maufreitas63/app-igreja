import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

type Props = {
  count: number;
  maxCapacity?: number | null;
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

export function ParticipantCupBadge({ count, maxCapacity, size = 'sm', style }: Props) {
  const fillRatio =
    maxCapacity && maxCapacity > 0
      ? Math.min(count / maxCapacity, 1)
      : count > 0
        ? 0.55
        : 0;

  const cupStyle = size === 'sm' ? styles.cupSm : styles.cupMd;
  const countStyle = size === 'sm' ? styles.countSm : styles.countMd;

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityLabel={`${count} participantes`}
      accessibilityRole="text"
    >
      <View style={cupStyle}>
        <View style={[styles.liquid, { height: `${Math.max(fillRatio * 100, 10)}%` }]} />
        <Text style={[styles.countInside, countStyle]}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cupSm: {
    width: 28,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: MINIMAL_UI.icon,
    backgroundColor: MINIMAL_UI.rowHover,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cupMd: {
    width: 36,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: MINIMAL_UI.icon,
    backgroundColor: MINIMAL_UI.rowHover,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  liquid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: MINIMAL_UI.textMuted,
    opacity: 0.35,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  countInside: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    color: MINIMAL_UI.icon,
    fontWeight: '800',
  },
  countSm: {
    fontSize: 11,
    lineHeight: 34,
  },
  countMd: {
    fontSize: 13,
    lineHeight: 44,
  },
});
