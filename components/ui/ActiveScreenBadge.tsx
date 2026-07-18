import { UI_ACCENT_STYLES, type UiAccent } from '@/lib/uiTokens';
import { cn } from '@/lib/utils';
import React from 'react';
import { Text, View } from 'react-native';

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
    <View
      className={cn(
        'max-w-full shrink',
        isRight ? 'max-w-[48%] shrink-0 items-end' : 'items-start'
      )}
    >
      <Text
        numberOfLines={2}
        className={cn(
          'text-[13px] font-extrabold leading-4 tracking-[0.4px]',
          isRight ? 'text-right' : 'text-left'
        )}
        style={{ color: textColor }}
        accessibilityRole="text"
      >
        {title}
      </Text>
      {trimmedTechnicalKey ? (
        <Text
          numberOfLines={2}
          className={cn(
            'mt-0.5 text-[10px] font-semibold leading-[13px] tracking-[0.2px] opacity-70',
            isRight ? 'text-right' : 'text-left'
          )}
          style={{ color: textColor }}
          accessibilityRole="text"
          accessibilityLabel={`Chave ACL: ${trimmedTechnicalKey}`}
        >
          {trimmedTechnicalKey}
        </Text>
      ) : null}
    </View>
  );
}
