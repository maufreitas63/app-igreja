import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { DASHBOARD_CARD_TYPO } from '@/lib/dashboardCardStyles';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export type FamilyAgendaViewProps = {
  loading?: boolean;
  events: ActiveEventListItem[];
  selectedEvent: ActiveEventListItem | null;
  eventsError?: Error | null;
  kidsRoomBadgeLabel: string;
  teensRoomBadgeLabel: string;
  capacityFillColor: string;
  capacityRatio: number;
  registrationSection?: ReactNode;
  loginRequiredMessage?: string | null;
};

/** Visualização pura da Agenda da Família (Card 1) — identidade vigilance_scales. */
export function FamilyAgendaView({
  loading = false,
  events,
  selectedEvent,
  eventsError = null,
  kidsRoomBadgeLabel,
  teensRoomBadgeLabel,
  capacityFillColor,
  capacityRatio,
  registrationSection,
  loginRequiredMessage = null,
}: FamilyAgendaViewProps) {
  const selectedEventTime = selectedEvent ? formatEventDateTimeLabel(selectedEvent.event_date) : null;

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="large" />
      </View>
    );
  }

  if (!events.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.placeholderText}>
          No momento não há eventos disponíveis. Aguarde os próximos eventos.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <View style={[styles.section, styles.heroSection]}>
        <View style={styles.heroRow}>
          <View style={styles.summary}>
            <Text style={styles.sectionLabel}>Evento Selecionado</Text>
            {selectedEvent ? (
              <>
                <Text style={styles.eventName} numberOfLines={2}>
                  {selectedEvent.name}
                </Text>
                {selectedEventTime ? <Text style={styles.eventMeta}>{selectedEventTime}</Text> : null}
                {selectedEvent.event_local ? (
                  <Text style={styles.eventLocation}>{selectedEvent.event_local}</Text>
                ) : null}
                {selectedEvent.kids_room || selectedEvent.teens_room ? (
                  <View style={styles.roomLegendRow}>
                    {selectedEvent.kids_room ? (
                      <View style={[styles.roomBadge, styles.roomBadgeKids, styles.roomBadgeInline]}>
                        <View style={[styles.roomIndicator, styles.roomIndicatorKids]} />
                        <Text style={styles.roomBadgeText} numberOfLines={1}>
                          {kidsRoomBadgeLabel}
                        </Text>
                      </View>
                    ) : null}
                    {selectedEvent.teens_room ? (
                      <View style={[styles.roomBadge, styles.roomBadgeTeens, styles.roomBadgeInline]}>
                        <View style={[styles.roomIndicator, styles.roomIndicatorTeens]} />
                        <Text style={styles.roomBadgeText} numberOfLines={1}>
                          {teensRoomBadgeLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.placeholderText}>Selecione um evento.</Text>
            )}
          </View>

          <View style={styles.capacityCard}>
            <Text style={styles.sectionLabel}>Vagas</Text>
            {eventsError ? (
              <Text style={styles.capacityPlaceholder}>--</Text>
            ) : selectedEvent && selectedEvent.remainingCapacity !== null ? (
              <View style={styles.capacityCupWrapper}>
                <View style={styles.capacityCup}>
                  <View
                    style={[
                      styles.capacityLiquid,
                      {
                        height: `${Math.max(capacityRatio * 100, 8)}%`,
                        backgroundColor: capacityFillColor,
                      },
                    ]}
                  />
                  <View style={styles.capacityOverlay}>
                    <Text style={styles.capacityValue}>({selectedEvent.remainingCapacity})</Text>
                    <Text style={styles.capacityMeta}>
                      {selectedEvent.registeredCount}/{selectedEvent.max_capacity}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.capacityPlaceholder}>--</Text>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.section, styles.membersSection]}>
        {!selectedEvent ? (
          <Text style={styles.sectionHint}>Selecione um evento para registrar participantes.</Text>
        ) : null}
        {registrationSection}
        {loginRequiredMessage ? (
          <Text style={styles.placeholderText}>{loginRequiredMessage}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    gap: 8,
    backgroundColor: VIGILANCE_SCALES_UI.surface,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingVertical: 24,
    backgroundColor: VIGILANCE_SCALES_UI.surface,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: VIGILANCE_SCALES_UI.surface,
  },
  section: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 16,
    padding: 14,
  },
  heroSection: {
    padding: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  summary: {
    flex: 1,
    minWidth: 0,
  },
  sectionLabel: {
    ...DASHBOARD_CARD_TYPO.sectionLabel,
    color: VIGILANCE_SCALES_UI.accent,
  },
  eventName: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 4,
  },
  eventMeta: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  eventLocation: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.88,
  },
  placeholderText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.85,
    marginTop: 4,
  },
  sectionHint: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    opacity: 0.88,
    marginBottom: 8,
  },
  roomLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    width: '100%',
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  roomBadgeInline: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    justifyContent: 'center',
  },
  roomBadgeKids: {
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  roomBadgeTeens: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  roomBadgeText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
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
  capacityCard: {
    width: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: VIGILANCE_SCALES_UI.surface,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  capacityCupWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  capacityCup: {
    width: 70,
    height: 84,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  capacityLiquid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    opacity: 0.85,
  },
  capacityOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  capacityValue: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  capacityMeta: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
    opacity: 0.88,
  },
  capacityPlaceholder: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    opacity: 0.6,
  },
  membersSection: {
    gap: 8,
  },
});
