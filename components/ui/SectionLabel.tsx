import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { cn } from '@/lib/utils';
import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type SectionLabelProps = {
  children: string;
  spaced?: boolean;
  tight?: boolean;
  variant?: 'form' | 'maintenance' | 'vigilance';
  style?: StyleProp<TextStyle>;
};

export function SectionLabel({
  children,
  spaced = false,
  tight = false,
  variant = 'form',
  style,
}: SectionLabelProps) {
  return (
    <Text
      className={cn(
        variant === 'maintenance' &&
          'mb-1.5 mt-1 text-xs font-bold uppercase tracking-wide text-slate-300',
        variant === 'vigilance' && 'mb-1 text-[13px] font-bold',
        variant === 'form' && 'mb-1 text-[13px] font-semibold text-emerald-500',
        spaced && 'mt-1',
        tight && 'mb-0.5 mt-0'
      )}
      style={[
        variant === 'vigilance' ? { color: VIGILANCE_SCALES_UI.accent } : null,
        style,
      ]}
      accessibilityRole="text"
    >
      {children}
    </Text>
  );
}
