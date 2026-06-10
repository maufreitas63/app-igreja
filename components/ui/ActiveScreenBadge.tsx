import { UI_ACCENT_STYLES, UI_TYPO, type UiAccent } from '@/lib/uiTokens';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ActiveScreenBadgeProps = {
  title: string;
  accent?: UiAccent;
  /** Chave ACL (`resource_key`) exibida só para super admin. */
  technicalKey?: string | null;
};

export function ActiveScreenBadge({
  title,
  accent = 'emerald',
  technicalKey,
}: ActiveScreenBadgeProps) {
  if (!title.trim()) {
    return null;
  }

  const accentStyle = UI_ACCENT_STYLES[accent];
  const trimmedTechnicalKey = technicalKey?.trim() ?? '';

  return (
    <View style={styles.wrap}>
      <Text
        numberOfLines={2}
        style={[styles.badge, { color: accentStyle.moduleColor }]}
        accessibilityRole="text"
      >
        {title}
      </Text>
      {trimmedTechnicalKey ? (
        <Text
          numberOfLines={2}
          style={[styles.technicalKey, { color: accentStyle.moduleColor }]}
          accessibilityRole="text"
          accessibilityLabel={`Chave ACL: ${trimmedTechnicalKey}`}
        >
          {trimmedTechnicalKey}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    maxWidth: '48%',
    alignItems: 'flex-end',
  },
  badge: {
    fontSize: UI_TYPO.activeModule.fontSize,
    fontWeight: UI_TYPO.activeModule.fontWeight,
    textAlign: 'right',
    letterSpacing: UI_TYPO.activeModule.letterSpacing,
    lineHeight: UI_TYPO.activeModule.lineHeight,
  },
  technicalKey: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
    letterSpacing: 0.2,
    lineHeight: 13,
    opacity: 0.72,
  },
});
