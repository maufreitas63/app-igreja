import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

export type AgeBracketSlice = {
  label: string;
  value: number;
};

/** Cor fixa por faixa — paleta viva e bem contrastada entre faixas adjacentes. */
const AGE_BRACKET_COLORS: Record<string, string> = {
  '60+ anos': '#EF4444',
  '45-59 anos': '#F97316',
  '30-44 anos': '#EAB308',
  '18-29 anos': '#22C55E',
  '13-17 anos': '#06B6D4',
  '0-12 anos': '#3B82F6',
  'Sem data': '#A855F7',
};

const FALLBACK_SLICE_COLORS = ['#EC4899', '#84CC16', '#14B8A6', '#F43F5E', '#8B5CF6'] as const;

const colorForBracket = (label: string, index: number) =>
  AGE_BRACKET_COLORS[label] ?? FALLBACK_SLICE_COLORS[index % FALLBACK_SLICE_COLORS.length];

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
        color: colorForBracket(slice.label, index),
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
            <Path key={slice.label} d={slice.path} fill={slice.color} stroke="#0B1220" strokeWidth={1.25} />
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
    width: 9,
    height: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.65)',
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
