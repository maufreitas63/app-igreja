import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type InboxListItem = {
  id: string;
  subject: string;
  preview?: string;
  meta?: string;
  /** Conteúdo à direita da linha (ex.: copo com participantes). */
  trailing?: React.ReactNode;
  content: React.ReactNode;
};

type Props = {
  items: InboxListItem[];
  emptyMessage?: string;
};

export function InboxList({ items, emptyMessage = 'Nenhum item.' }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!items.length) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const expanded = expandedId === item.id;

        return (
          <View key={item.id} style={styles.rowWrap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpandedId((current) => (current === item.id ? null : item.id))}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <FontAwesome
                name={expanded ? 'chevron-down' : 'chevron-right'}
                size={MINIMAL_ICON.chevron}
                color={MINIMAL_UI.icon}
                style={styles.chevron}
              />
              <View style={styles.textBlock}>
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
              {item.trailing ? <View style={styles.trailing}>{item.trailing}</View> : null}
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
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 10,
  },
  rowPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  chevron: {
    marginTop: 4,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  trailing: {
    flexShrink: 0,
    alignSelf: 'center',
    paddingLeft: 4,
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
