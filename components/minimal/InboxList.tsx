import { EventRegistrationCupInline } from '@/components/minimal/EventRegistrationCupInline';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
};

/** Lista informativa de eventos — linhas estáticas, sem abrir detalhes ao toque. */
export function InboxList({ items, emptyMessage = 'Nenhum item.' }: Props) {
  if (!items.length) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id} style={styles.rowWrap}>
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
            {item.event ? <EventRegistrationCupInline event={item.event} /> : null}
          </View>
        </View>
      ))}
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
  rowWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    marginBottom: -1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 8,
    backgroundColor: MINIMAL_UI.background,
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
  empty: {
    color: MINIMAL_UI.blue,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
});
