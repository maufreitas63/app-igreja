import { NO_BOX_SHADOW } from '@/lib/boxShadow';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  const listMaxHeight =
    INBOX_EVENT_ROW_HEIGHT * maxVisibleRows + INBOX_EVENT_ROW_GAP * Math.max(0, maxVisibleRows - 1);

  return (
    <ScrollView
      style={[styles.list, { maxHeight: listMaxHeight }]}
      contentContainerStyle={styles.listContent}
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
          style={({ pressed, hovered }) => [
            styles.eventButton,
            (pressed || (Platform.OS === 'web' && hovered)) && styles.eventButtonHovered,
          ]}
        >
          <View style={styles.row}>
            <View style={styles.textBlock}>
              <Text style={styles.subject} numberOfLines={1}>
                {item.subject}
              </Text>
              {item.preview ? (
                <Text style={styles.preview} numberOfLines={1}>
                  {item.preview}
                </Text>
              ) : null}
              {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
    flexGrow: 0,
  },
  listContent: {
    flexGrow: 0,
    gap: INBOX_EVENT_ROW_GAP,
  },
  eventButton: {
    width: '100%',
    height: INBOX_EVENT_ROW_HEIGHT,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 16,
    ...NO_BOX_SHADOW,
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
        }
      : null),
  },
  eventButtonHovered: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: 'transparent',
  },
  textBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  subject: {
    ...MINIMAL_TYPO.inboxSubject,
    color: MINIMAL_UI.blue,
    textAlign: 'left',
  },
  preview: {
    ...MINIMAL_TYPO.inboxPreview,
    color: MINIMAL_UI.blue,
    textAlign: 'left',
  },
  meta: {
    fontSize: 11,
    lineHeight: 14,
    color: MINIMAL_UI.blue,
    backgroundColor: 'transparent',
    textAlign: 'left',
  },
  empty: {
    color: MINIMAL_UI.blue,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
});
