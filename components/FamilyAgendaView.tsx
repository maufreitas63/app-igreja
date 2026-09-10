import type { ActiveEventListItem } from '@/hooks/useActiveEvents';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export type FamilyAgendaViewProps = {
  loading?: boolean;
  events: ActiveEventListItem[];
  selectedEvent: ActiveEventListItem | null;
  eventsError?: Error | null;
  capacityFillColor: string;
  capacityRatio: number;
  registrationSection?: ReactNode;
  loginRequiredMessage?: string | null;
};

/** Visualização pura da Agenda da Família (Card 1) — identidade MINIMAL_UI. */
export function FamilyAgendaView({
  loading = false,
  events,
  selectedEvent,
  eventsError = null,
  capacityFillColor,
  capacityRatio,
  registrationSection,
  loginRequiredMessage = null,
}: FamilyAgendaViewProps) {
  const selectedEventTime = selectedEvent
    ? formatEventDateTimeLabel(selectedEvent.event_date, selectedEvent.event_end_date)
    : null;

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={MINIMAL_UI.accent} size="large" />
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
    minWidth: 0,
    alignSelf: 'stretch',
    gap: 8,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingVertical: 24,
    backgroundColor: MINIMAL_UI.background,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: MINIMAL_UI.background,
  },
  section: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
  },
  heroSection: {
    padding: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  summary: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  sectionLabel: {
    ...MINIMAL_TYPO.sectionLabel,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventName: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 4,
  },
  eventMeta: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  eventLocation: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.88,
  },
  placeholderText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    opacity: 0.85,
    marginTop: 4,
  },
  sectionHint: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    opacity: 0.88,
    marginBottom: 8,
  },
  capacityCard: {
    width: 96,
    flexShrink: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
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
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
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
    color: MINIMAL_UI.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  capacityMeta: {
    color: MINIMAL_UI.text,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
    opacity: 0.88,
  },
  capacityPlaceholder: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    opacity: 0.6,
  },
  membersSection: {
    gap: 8,
  },
});
