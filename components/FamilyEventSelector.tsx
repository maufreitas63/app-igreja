import { createStyles } from '@/lib/createStyles';
import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CHIP_WIDTH = 170;
const CHIP_GAP = 8;
const CHIP_STRIDE = CHIP_WIDTH + CHIP_GAP;
/** ~2 mm entre os chips e a barra de rolagem horizontal. */
const SCROLLBAR_GAP = 8;

type FamilyEventSelectorProps = {
  events: ActiveEventListItem[];
  selectedEventId: string | null | undefined;
  onSelectEvent: (eventId: string) => void;
  /** `vigilance` — chips claros com texto azul (card Escalas). */
  variant?: 'default' | 'vigilance';
};

export const FamilyEventSelector = ({
  events,
  selectedEventId,
  onSelectEvent,
  variant = 'default',
}: FamilyEventSelectorProps) => {
  const isVigilance = variant === 'vigilance';
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
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          viewportWidthRef.current = event.nativeEvent.layout.width;
        }}
        {...(Platform.OS === 'web' ? { className: 'family-event-selector-scroll' } : {})}
      >
        {events.map((event) => {
          const isSelected = event.id === selectedEventId;
          const eventTime = formatEventDateTimeLabel(event.event_date);

          return (
            <TouchableOpacity
              key={event.id}
              style={[
                styles.chip,
                isVigilance && styles.chipVigilance,
                isSelected && (isVigilance ? styles.chipVigilanceSelected : styles.chipSelected),
              ]}
              onPress={() => handleSelect(event.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
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
                style={[
                  styles.chipTitle,
                  isVigilance && styles.chipTitleVigilance,
                  isSelected && (isVigilance ? styles.chipTitleVigilanceSelected : styles.chipTitleSelected),
                ]}
                numberOfLines={1}
              >
                {event.name}
              </Text>
              {eventTime ? (
                <Text
                  style={[
                    styles.chipMeta,
                    isVigilance && styles.chipMetaVigilance,
                    isSelected && (isVigilance ? styles.chipMetaVigilanceSelected : styles.chipMetaSelected),
                  ]}
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

const styles = createStyles({
  wrapper: {
    width: '100%' as const,
    ...(Platform.OS === 'web' ? {} : { overflow: 'hidden' as const }),
  },
  scroll: {
    width: '100%' as const,
    flexGrow: 0,
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'scroll',
          scrollbarWidth: 'thin',
        } as unknown as ViewStyle)
      : {}),
  },
  row: {
    flexDirection: 'row' as const,
    flexWrap: 'nowrap' as const,
    alignItems: 'stretch' as const,
    paddingRight: 8,
    paddingBottom: SCROLLBAR_GAP,
    ...(Platform.OS === 'web'
      ? ({
          display: 'flex',
          flexDirection: 'row',
          width: 'max-content',
        } as unknown as ViewStyle)
      : {}),
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
  chipVigilance: {
    backgroundColor: VIGILANCE_SCALES_UI.surface,
    borderColor: VIGILANCE_SCALES_UI.borderMuted,
  },
  chipVigilanceSelected: {
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
    borderColor: VIGILANCE_SCALES_UI.accent,
  },
  chipIndicators: {
    position: 'absolute' as const,
    top: 11,
    right: 10,
    alignItems: 'center' as const,
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
  chipTitleVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  chipTitleVigilanceSelected: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  chipMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 5,
  },
  chipMetaSelected: {
    color: '#BAE6FD',
  },
  chipMetaVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 0.85,
  },
  chipMetaVigilanceSelected: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 1,
  },
});
