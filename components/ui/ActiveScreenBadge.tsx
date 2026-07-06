import { UI_ACCENT_STYLES, UI_TYPO, type UiAccent } from '@/lib/uiTokens';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ActiveScreenBadgeProps = {
  title: string;
  accent?: UiAccent;
  /** Sobrescreve a cor do título e da chave técnica. */
  color?: string;
  /** Chave ACL (`resource_key`) exibida só para super admin com `Exibir_nomes_tecnicos = sim`. */
  technicalKey?: string | null;
  /** Alinhamento do título e da chave técnica. */
  align?: 'left' | 'right';
};

export function ActiveScreenBadge({
  title,
  accent = 'emerald',
  color,
  technicalKey,
  align = 'left',
}: ActiveScreenBadgeProps) {
  if (!title.trim()) {
    return null;
  }

  const accentStyle = UI_ACCENT_STYLES[accent];
  const textColor = color ?? accentStyle.moduleColor;
  const trimmedTechnicalKey = technicalKey?.trim() ?? '';
  const isRight = align === 'right';

  return (
    <View style={[styles.wrap, isRight ? styles.wrapRight : styles.wrapLeft]}>
      <Text
        numberOfLines={2}
        style={[
          styles.badge,
          isRight ? styles.textRight : styles.textLeft,
          { color: textColor },
        ]}
        accessibilityRole="text"
      >
        {title}
      </Text>
      {trimmedTechnicalKey ? (
        <Text
          numberOfLines={2}
          style={[
            styles.technicalKey,
            isRight ? styles.textRight : styles.textLeft,
            { color: textColor },
          ]}
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
    flexShrink: 1,
    maxWidth: '100%',
  },
  wrapLeft: {
    alignItems: 'flex-start',
  },
  wrapRight: {
    flexShrink: 0,
    maxWidth: '48%',
    alignItems: 'flex-end',
  },
  badge: {
    fontSize: UI_TYPO.activeModule.fontSize,
    fontWeight: UI_TYPO.activeModule.fontWeight,
    letterSpacing: UI_TYPO.activeModule.letterSpacing,
    lineHeight: UI_TYPO.activeModule.lineHeight,
  },
  technicalKey: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 13,
    opacity: 0.72,
  },
  textLeft: {
    textAlign: 'left',
  },
  textRight: {
    textAlign: 'right',
  },
});
