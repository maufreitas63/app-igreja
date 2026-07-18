import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

export const INBOX_EVENT_ROW_HEIGHT = 80;
export const INBOX_VISIBLE_EVENT_ROWS = 4;
export const INBOX_EVENT_ROW_GAP = 8;
export const INBOX_LIST_MAX_HEIGHT =
  INBOX_EVENT_ROW_HEIGHT * INBOX_VISIBLE_EVENT_ROWS +
  INBOX_EVENT_ROW_GAP * Math.max(0, INBOX_VISIBLE_EVENT_ROWS - 1);

export type InboxListItem = {
  id: string;
  subject: string;
  preview?: string;
  meta?: string;
  event?: ActiveEventListItem;
};

type Props = {
  items: InboxListItem[];
  emptyMessage?: string;
  onItemPress?: (item: InboxListItem) => void;
  /** Altura da janela da lista em número de linhas visíveis (padrão: 4). */
  maxVisibleRows?: number;
};

/** Lista de eventos — cada linha é um botão minimalista que abre detalhes. */
export function InboxList({
  items,
  emptyMessage = 'Nenhum item.',
  onItemPress,
  maxVisibleRows = INBOX_VISIBLE_EVENT_ROWS,
}: Props) {
  if (!items.length) {
    return (
      <Text className="bg-minimal-bg py-6 text-center text-sm text-minimal-blue">{emptyMessage}</Text>
    );
  }

  const listMaxHeight =
    INBOX_EVENT_ROW_HEIGHT * maxVisibleRows + INBOX_EVENT_ROW_GAP * Math.max(0, maxVisibleRows - 1);

  return (
    <ScrollView
      className="w-full grow-0 bg-minimal-bg"
      style={{ maxHeight: listMaxHeight }}
      contentContainerClassName="grow-0 gap-2"
      nestedScrollEnabled
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onItemPress?.(item)}
          disabled={!onItemPress}
          accessibilityRole="button"
          accessibilityLabel={item.subject}
          className="h-20 w-full cursor-pointer rounded-2xl border bg-minimal-bg px-0 py-0 active:bg-minimal-hover hover:bg-minimal-hover"
          style={{ borderColor: 'rgba(52, 211, 153, 0.35)' }}
        >
          <View className="flex-1 flex-row items-center gap-1.5 bg-transparent px-3 py-2">
            <View className="min-w-0 flex-1 justify-center gap-0.5 bg-transparent">
              <Text className="text-left text-minimal-inbox text-minimal-blue" numberOfLines={1}>
                {item.subject}
              </Text>
              {item.preview ? (
                <Text className="text-left text-minimal-preview text-minimal-blue" numberOfLines={1}>
                  {item.preview}
                </Text>
              ) : null}
              {item.meta ? (
                <Text className="bg-transparent text-left text-[11px] leading-[14px] text-minimal-blue">
                  {item.meta}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
