import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { UI_COLORS, UI_SEGMENT, UI_TYPO } from '@/lib/uiTokens';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type SegmentChipOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type SegmentChipRowProps<T extends string> = {
  options: SegmentChipOption<T>[];
  selectedValue: T | null;
  onSelect: (value: T) => void;
  variant?: 'default' | 'vigilance';
  compact?: boolean;
};

export function SegmentChipRow<T extends string>({
  options,
  selectedValue,
  onSelect,
  variant = 'default',
  compact = false,
}: SegmentChipRowProps<T>) {
  const isVigilance = variant === 'vigilance';

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            activeOpacity={0.85}
            onPress={() => onSelect(option.value)}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              isVigilance && styles.chipVigilance,
              isSelected && (isVigilance ? styles.chipVigilanceSelected : styles.chipSelected),
            ]}
          >
            <Text
              style={[
                styles.chipText,
                compact && styles.chipTextCompact,
                isVigilance && styles.chipTextVigilance,
                isSelected && (isVigilance ? styles.chipTextVigilanceSelected : styles.chipTextSelected),
              ]}
              numberOfLines={2}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  rowCompact: {
    gap: 6,
    marginBottom: 4,
  },
  chip: {
    flex: 1,
    minHeight: UI_SEGMENT.minHeight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI_COLORS.borderMuted,
    backgroundColor: UI_COLORS.surfaceCard,
    paddingHorizontal: UI_SEGMENT.paddingHorizontal,
    paddingVertical: UI_SEGMENT.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCompact: {
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  chipSelected: {
    borderColor: UI_COLORS.segmentBorderPurple,
    backgroundColor: UI_COLORS.segmentSelectedPurple,
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: UI_TYPO.segment.fontSize,
    fontWeight: UI_TYPO.segment.fontWeight,
    textAlign: 'center',
    lineHeight: UI_TYPO.segment.lineHeight,
  },
  chipTextCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  chipTextSelected: {
    color: '#F5F3FF',
  },
  chipVigilance: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
  },
  chipVigilanceSelected: {
    borderColor: '#1B4F8A',
    backgroundColor: VIGILANCE_SCALES_UI.accent,
  },
  chipTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  chipTextVigilanceSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
