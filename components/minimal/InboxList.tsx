import { EventRegistrationCupInline } from '@/components/minimal/EventRegistrationCupInline';
import { MinimalExpandedEventHeader } from '@/components/minimal/MinimalExpandedEventHeader';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type InboxListItem = {
  id: string;
  subject: string;
  preview?: string;
  meta?: string;
  event?: ActiveEventListItem;
  content: React.ReactNode;
};

type Props = {
  items: InboxListItem[];
  emptyMessage?: string;
};

export function InboxList({ items, emptyMessage = 'Nenhum item.' }: Props) {
  const { expandedEventId, setExpandedEvent } = useMinimalHome();

  const handleCollapse = () => {
    setExpandedEvent(null);
  };

  if (!items.length) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  const visibleItems = expandedEventId
    ? items.filter((item) => item.id === expandedEventId)
    : items;

  return (
    <View style={[styles.list, expandedEventId ? styles.listExpanded : null]}>
      {visibleItems.map((item) => {
        const expanded = expandedEventId === item.id;

        return (
          <View key={item.id} style={[styles.rowWrap, expanded ? styles.rowWrapExpanded : null]}>
            {expanded && item.event ? (
              <MinimalExpandedEventHeader event={item.event} onBack={handleCollapse} />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setExpandedEvent(item.event ?? null);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
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
                {item.event ? <EventRegistrationCupInline event={item.event} /> : null}
              </Pressable>
            )}
            {expanded ? <View style={styles.expanded}>{item.content}</View> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.background,
  },
  listExpanded: {
    flex: 1,
    minHeight: 0,
  },
  rowWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    marginBottom: -1,
  },
  rowWrapExpanded: {
    flex: 1,
    minHeight: 0,
    borderTopWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 8,
    backgroundColor: MINIMAL_UI.background,
  },
  rowPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  textBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.background,
  },
  subject: {
    ...MINIMAL_TYPO.inboxSubject,
    color: MINIMAL_UI.blue,
  },
  preview: {
    ...MINIMAL_TYPO.inboxPreview,
    color: MINIMAL_UI.blue,
  },
  meta: {
    fontSize: 12,
    color: MINIMAL_UI.blue,
    backgroundColor: MINIMAL_UI.background,
  },
  expanded: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 8,
    paddingBottom: 16,
    backgroundColor: MINIMAL_UI.background,
    borderTopWidth: 1,
    borderTopColor: MINIMAL_UI.border,
  },
  empty: {
    color: MINIMAL_UI.blue,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
});
