import { UI_COLORS, UI_TYPO } from '@/lib/uiTokens';
import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

type SectionLabelProps = {
  children: string;
  spaced?: boolean;
  tight?: boolean;
  variant?: 'form' | 'maintenance';
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
      style={[
        variant === 'maintenance' ? styles.maintenanceLabel : styles.label,
        spaced && styles.spaced,
        tight && styles.tight,
        style,
      ]}
      accessibilityRole="text"
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    color: UI_COLORS.borderAccentEmerald,
    marginBottom: 4,
    fontSize: UI_TYPO.sectionLabel.fontSize,
    fontWeight: UI_TYPO.sectionLabel.fontWeight,
  },
  maintenanceLabel: {
    color: UI_COLORS.maintenanceSectionLabel,
    marginBottom: 6,
    marginTop: 4,
    fontSize: UI_TYPO.maintenanceSectionLabel.fontSize,
    fontWeight: UI_TYPO.maintenanceSectionLabel.fontWeight,
    letterSpacing: UI_TYPO.maintenanceSectionLabel.letterSpacing,
    textTransform: 'uppercase',
  },
  spaced: {
    marginTop: 4,
  },
  tight: {
    marginTop: 0,
  },
});
