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
};

export function SegmentChipRow<T extends string>({
  options,
  selectedValue,
  onSelect,
}: SegmentChipRowProps<T>) {
  return (
    <View style={styles.row}>
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
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text
              style={[styles.chipText, isSelected && styles.chipTextSelected]}
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
  chipTextSelected: {
    color: '#F5F3FF',
  },
});
