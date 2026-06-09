import { UI_ACCENT_STYLES, UI_TYPO, type UiAccent } from '@/lib/uiTokens';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

type ActiveScreenBadgeProps = {
  title: string;
  accent?: UiAccent;
};

export function ActiveScreenBadge({ title, accent = 'emerald' }: ActiveScreenBadgeProps) {
  if (!title.trim()) {
    return null;
  }

  const accentStyle = UI_ACCENT_STYLES[accent];

  return (
    <Text
      numberOfLines={2}
      style={[styles.badge, { color: accentStyle.moduleColor }]}
      accessibilityRole="text"
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    maxWidth: '48%',
    fontSize: UI_TYPO.activeModule.fontSize,
    fontWeight: UI_TYPO.activeModule.fontWeight,
    textAlign: 'right',
    letterSpacing: UI_TYPO.activeModule.letterSpacing,
    lineHeight: UI_TYPO.activeModule.lineHeight,
  },
});
