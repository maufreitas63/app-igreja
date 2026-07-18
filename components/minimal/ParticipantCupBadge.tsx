import { cn } from '@/lib/utils';
import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';

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

  return (
    <View
      className="items-center justify-center"
      style={style}
      accessibilityLabel={`${count} participantes`}
      accessibilityRole="text"
    >
      <View
        className={cn(
          'items-center justify-end overflow-hidden border-minimal-icon bg-minimal-hover',
          size === 'sm' ? 'h-[34px] w-7 rounded-lg border-[1.5px]' : 'h-[66px] w-[54px] rounded-[10px] border-2'
        )}
      >
        <View
          className="absolute bottom-0 left-0 right-0 rounded-t-md bg-minimal-muted opacity-35"
          style={{ height: `${Math.max(fillRatio * 100, 10)}%` }}
        />
        <Text
          className={cn(
            'absolute bottom-0 left-0 right-0 top-0 text-center font-extrabold text-minimal-icon',
            size === 'sm' ? 'text-[11px] leading-[34px]' : 'text-[13px] leading-[66px]'
          )}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}
