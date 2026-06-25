import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

export type AgeBracketSlice = {
  label: string;
  value: number;
};

const SLICE_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#C084FC',
  '#60A5FA',
  '#34D399',
  '#94A3B8',
] as const;

const SIZE = 132;
const CENTER = SIZE / 2;
const RADIUS = 54;

const polarToCartesian = (angleDeg: number) => {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;

  return {
    x: CENTER + RADIUS * Math.cos(angleRad),
    y: CENTER + RADIUS * Math.sin(angleRad),
  };
};

const describeSlice = (startAngle: number, endAngle: number) => {
  if (endAngle - startAngle >= 359.99) {
    return [
      `M ${CENTER} ${CENTER}`,
      `m 0 -${RADIUS}`,
      `a ${RADIUS} ${RADIUS} 0 1 1 0 ${RADIUS * 2}`,
      `a ${RADIUS} ${RADIUS} 0 1 1 0 -${RADIUS * 2}`,
      'Z',
    ].join(' ');
  }

  const start = polarToCartesian(endAngle);
  const end = polarToCartesian(startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
};

type Props = {
  slices: AgeBracketSlice[];
};

export function AgeBracketPieChart({ slices }: Props) {
  const chartSlices = useMemo(() => {
    const valid = slices.filter((slice) => slice.value > 0 && slice.label.trim());

    if (valid.length === 0) {
      return [];
    }

    const total = valid.reduce((sum, slice) => sum + slice.value, 0);

    if (total <= 0) {
      return [];
    }

    let cursor = 0;

    return valid.map((slice, index) => {
      const sweep = (slice.value / total) * 360;
      const startAngle = cursor;
      const endAngle = cursor + sweep;
      cursor = endAngle;

      return {
        ...slice,
        color: SLICE_COLORS[index % SLICE_COLORS.length],
        percent: (slice.value / total) * 100,
        path: describeSlice(startAngle, endAngle),
      };
    });
  }, [slices]);

  if (chartSlices.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel="Gráfico de pizza por faixa etária">
      <Text style={styles.title}>Distribuição</Text>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <G>
          {chartSlices.map((slice) => (
            <Path key={slice.label} d={slice.path} fill={slice.color} stroke="#0F172A" strokeWidth={1} />
          ))}
        </G>
      </Svg>
      <View style={styles.legend}>
        {chartSlices.map((slice) => (
          <View key={slice.label} style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: slice.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={styles.legendValue}>
              {slice.percent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 168,
    flexShrink: 0,
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  title: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  legend: {
    alignSelf: 'stretch',
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendLabel: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 10,
    lineHeight: 13,
  },
  legendValue: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'right',
  },
});

export const parseAgeBracketChartSlices = (
  rows: Record<string, unknown>[]
): AgeBracketSlice[] =>
  rows
    .map((row) => ({
      label: String(row.faixa ?? '').trim(),
      value: Number(row.quantidade ?? 0),
    }))
    .filter((slice) => slice.label && slice.label !== 'Sem data' && Number.isFinite(slice.value) && slice.value > 0);
