import { EventRegistrationCupInline } from '@/components/minimal/EventRegistrationCupInline';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import { FontAwesome } from '@expo/vector-icons';
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

  if (!items.length) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const expanded = expandedEventId === item.id;

        return (
          <View key={item.id} style={styles.rowWrap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (expanded) {
                  setExpandedEvent(null);
                  return;
                }

                setExpandedEvent(item.event ?? null);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <FontAwesome
                name={expanded ? 'chevron-down' : 'chevron-right'}
                size={MINIMAL_ICON.chevron}
                color={MINIMAL_UI.icon}
                style={styles.chevron}
              />
              <View style={[styles.textBlock, expanded && styles.textBlockExpanded]}>
                <Text style={styles.subject} numberOfLines={expanded ? undefined : 2}>
                  {item.subject}
                </Text>
                {item.preview ? (
                  <Text style={styles.preview} numberOfLines={expanded ? undefined : 1}>
                    {item.preview}
                  </Text>
                ) : null}
                {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
              </View>
              {expanded && item.event ? (
                <EventRegistrationCupInline event={item.event} />
              ) : null}
            </Pressable>
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
  },
  rowWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 8,
  },
  rowPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  chevron: {
    marginTop: 2,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  textBlockExpanded: {
    flex: 1,
    maxWidth: '68%',
  },
  subject: {
    ...MINIMAL_TYPO.inboxSubject,
  },
  preview: {
    ...MINIMAL_TYPO.inboxPreview,
  },
  meta: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
  },
  expanded: {
    paddingHorizontal: 8,
    paddingBottom: 16,
    backgroundColor: MINIMAL_UI.expandedBg,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
  },
});
