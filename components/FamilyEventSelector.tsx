import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CHIP_WIDTH = 170;
const CHIP_GAP = 8;
const CHIP_STRIDE = CHIP_WIDTH + CHIP_GAP;

type FamilyEventSelectorProps = {
  events: ActiveEventListItem[];
  selectedEventId: string | null | undefined;
  onSelectEvent: (eventId: string) => void;
};

export const FamilyEventSelector = ({
  events,
  selectedEventId,
  onSelectEvent,
}: FamilyEventSelectorProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const viewportWidthRef = useRef(0);

  const scrollEventIntoView = useCallback(
    (eventId: string) => {
      const index = events.findIndex((event) => event.id === eventId);
      if (index < 0) {
        return;
      }

      const viewportWidth =
        viewportWidthRef.current > 0 ? viewportWidthRef.current : SCREEN_WIDTH * 0.82;

      const chipStart = index * CHIP_STRIDE;
      const chipEnd = chipStart + CHIP_WIDTH;
      const edgePadding = 12;

      let offset = Math.max(0, chipStart - edgePadding);
      if (chipEnd - offset > viewportWidth - edgePadding) {
        offset = Math.max(0, chipEnd - viewportWidth + edgePadding);
      }

      const runScroll = () => {
        scrollRef.current?.scrollTo({ x: offset, y: 0, animated: true });
      };

      runScroll();
      requestAnimationFrame(runScroll);
      setTimeout(runScroll, 80);
    },
    [events]
  );

  const handleSelect = useCallback(
    (eventId: string) => {
      onSelectEvent(eventId);
      scrollEventIntoView(eventId);
    },
    [onSelectEvent, scrollEventIntoView]
  );

  useEffect(() => {
    if (!selectedEventId || !events.length) {
      return;
    }

    const timer = setTimeout(() => {
      scrollEventIntoView(selectedEventId);
    }, 150);

    return () => clearTimeout(timer);
  }, [events, scrollEventIntoView, selectedEventId]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        style={styles.scroll}
        contentContainerStyle={styles.row}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          viewportWidthRef.current = event.nativeEvent.layout.width;
        }}
      >
        {events.map((event) => {
          const isSelected = event.id === selectedEventId;
          const eventTime = formatEventDateTimeLabel(event.event_date);

          return (
            <TouchableOpacity
              key={event.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handleSelect(event.id)}
              activeOpacity={0.85}
            >
              {event.kids_room || event.teens_room ? (
                <View style={styles.chipIndicators}>
                  {event.kids_room ? (
                    <View style={[styles.roomIndicator, styles.roomIndicatorKids]} />
                  ) : null}
                  {event.teens_room ? (
                    <View style={[styles.roomIndicator, styles.roomIndicatorTeens]} />
                  ) : null}
                </View>
              ) : null}
              <Text
                style={[styles.chipTitle, isSelected && styles.chipTitleSelected]}
                numberOfLines={1}
              >
                {event.name}
              </Text>
              {eventTime ? (
                <Text
                  style={[styles.chipMeta, isSelected && styles.chipMetaSelected]}
                  numberOfLines={1}
                >
                  {eventTime}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  scroll: {
    width: '100%',
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    paddingRight: 8,
    ...(Platform.OS === 'web'
      ? {
          display: 'flex',
          flexDirection: 'row',
          width: 'max-content',
        }
      : null),
  },
  chip: {
    width: CHIP_WIDTH,
    flexShrink: 0,
    flexGrow: 0,
    marginRight: CHIP_GAP,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 32,
    position: 'relative',
  },
  chipSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderColor: '#67e8f9',
  },
  chipIndicators: {
    position: 'absolute',
    top: 11,
    right: 10,
    alignItems: 'center',
    gap: 5,
  },
  roomIndicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  roomIndicatorKids: {
    backgroundColor: '#FACC15',
  },
  roomIndicatorTeens: {
    backgroundColor: '#EF4444',
  },
  chipTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  chipTitleSelected: {
    color: '#ECFEFF',
  },
  chipMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 5,
  },
  chipMetaSelected: {
    color: '#BAE6FD',
  },
});
