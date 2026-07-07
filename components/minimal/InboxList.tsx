import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
};

/** Lista de eventos — cada linha é um botão minimalista que abre detalhes. */
export function InboxList({ items, emptyMessage = 'Nenhum item.', onItemPress }: Props) {
  if (!items.length) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <View style={styles.list}>
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
              <Text style={styles.subject} numberOfLines={2}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
  },
  eventButton: {
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 0,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 8,
    backgroundColor: 'transparent',
  },
  textBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
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
    fontSize: 12,
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
