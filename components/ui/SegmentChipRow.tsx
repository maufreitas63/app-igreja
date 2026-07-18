import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { cn } from '@/lib/utils';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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
    <View className={cn('mb-1.5 flex-row gap-2', compact && 'mb-1 gap-1.5')}>
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
            className={cn(
              'min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 px-2.5 py-2.5',
              compact && 'min-h-9 rounded-[10px] px-2 py-1.5',
              isVigilance && 'border-emerald-400/35 bg-white',
              isSelected && !isVigilance && 'border-purple-500 bg-purple-500/20',
              isSelected && isVigilance && 'border-[#1B4F8A]'
            )}
            style={
              isSelected && isVigilance
                ? { backgroundColor: VIGILANCE_SCALES_UI.accent }
                : undefined
            }
          >
            <Text
              className={cn(
                'text-center text-sm font-bold leading-[18px] text-slate-300',
                compact && 'text-[13px] leading-4',
                isSelected && !isVigilance && 'text-violet-50',
                isSelected && isVigilance && 'font-extrabold text-white'
              )}
              style={
                isVigilance && !isSelected
                  ? { color: VIGILANCE_SCALES_UI.accent }
                  : undefined
              }
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
