import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { useQuorumRegistry } from '@/hooks/useQuorumRegistry';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { formatShortName } from '@/lib/formatShortName';
import {
  formatEventDateDocumentLabel,
  formatEventTimeRangeLabel,
  formatQuorumCheckinTime,
} from '@/lib/quorumCheckinTime';
import {
  QUORUM_PRESENCE_DOCUMENT_TITLE,
  QUORUM_PRESENCE_INTRO_TEXT,
} from '@/lib/quorumPresenceDocument';
import { QUORUM_REGISTRY_SQL_HINT } from '@/lib/quorumRegistry';
import type { MaintenanceEvent } from '@/hooks/useMaintenanceEvents';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  events: MaintenanceEvent[];
  loadingEvents?: boolean;
  schemaMissing?: boolean;
  isActive?: boolean;
  panelHeight: number;
};

export function MaintenanceQuorumPresenceCard({
  events,
  loadingEvents,
  schemaMissing,
  isActive = true,
  panelHeight,
}: Props) {
  const quorumEvents = useMemo(
    () => (events ?? []).filter((event) => event.requer_quorum === true),
    [events]
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!quorumEvents.length) {
      setSelectedEventId(null);
      return;
    }

    const stillValid = quorumEvents.some((event) => event.id === selectedEventId);
    if (!stillValid) {
      setSelectedEventId(quorumEvents[0].id);
    }
  }, [quorumEvents, selectedEventId]);

  const selectedEvent = useMemo(
    () => quorumEvents.find((event) => event.id === selectedEventId) ?? null,
    [quorumEvents, selectedEventId]
  );

  const registryEnabled = Boolean(isActive && selectedEventId && !schemaMissing);

  const {
    rows,
    loading: isRegistryLoading,
    isRefreshing,
    error: registryError,
  } = useQuorumRegistry(registryEnabled ? selectedEventId ?? undefined : undefined, {
    pollMs: 15000,
    enabled: registryEnabled,
  });

  const documentHeight = computeMaintenanceContentHeight(panelHeight);

  if (loadingEvents) {
    return (
      <View style={[styles.panel, maintenancePanelStyles.panelCentered, { height: documentHeight }]}>
        <CardLoadingState lines={4} />
        <Text style={maintenancePanelStyles.panelHint}>Carregando eventos…</Text>
      </View>
    );
  }

  if (schemaMissing) {
    return (
      <View style={[styles.panel, styles.panelMessage, { height: documentHeight }]}>
        <Text style={styles.warningText}>Registro de quórum indisponível no Supabase.</Text>
        <Text style={styles.panelHint}>{QUORUM_REGISTRY_SQL_HINT}</Text>
      </View>
    );
  }

  if (!quorumEvents.length) {
    return (
      <View style={[styles.panel, styles.panelMessage, { height: documentHeight }]}>
        <FontAwesome name="clipboard" size={28} color="#64748B" />
        <Text style={maintenancePanelStyles.panelTitleMuted}>Lista de Presença</Text>
        <Text style={maintenancePanelStyles.panelHint}>
          Nenhum evento com Requer Quórum = Sim. Ative o quórum na edição de um evento para
          gerar a lista de check-in.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { height: documentHeight }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.eventChipRow}
        style={styles.eventChipScroll}
      >
        {quorumEvents.map((event) => {
          const isSelected = event.id === selectedEventId;

          return (
            <TouchableOpacity
              key={event.id}
              style={[styles.eventChip, isSelected && styles.eventChipSelected]}
              onPress={() => setSelectedEventId(event.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.eventChipText, isSelected && styles.eventChipTextSelected]}>
                {event.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.documentScroll}
        contentContainerStyle={styles.documentContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.document}>
          <View style={styles.documentTitleRow}>
            <FontAwesome name="clipboard" size={22} color="#1e3a8a" />
            <Text style={styles.documentTitle}>{QUORUM_PRESENCE_DOCUMENT_TITLE}</Text>
          </View>

          <Text style={styles.eventNameHeading} numberOfLines={2}>
            {selectedEvent?.name ?? 'Evento'}
          </Text>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Data: </Text>
              {formatEventDateDocumentLabel(selectedEvent?.event_date ?? null)}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Horário: </Text>
              {formatEventTimeRangeLabel(selectedEvent?.event_date ?? null)}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Local: </Text>
              {selectedEvent?.event_local?.trim() || '[Local do evento]'}
            </Text>
          </View>

          <Text style={styles.introText}>{QUORUM_PRESENCE_INTRO_TEXT}</Text>

          {isRegistryLoading ? (
            <View style={styles.listStateBox}>
              <CardLoadingState lines={3} compact />
              <Text style={styles.listStateText}>Carregando check-ins…</Text>
            </View>
          ) : registryError ? (
            <View style={styles.listStateBox}>
              <Text style={styles.listErrorText}>{registryError}</Text>
            </View>
          ) : (rows ?? []).length === 0 ? (
            <View style={styles.listStateBox}>
              <Text style={styles.listStateText}>
                Nenhum check-in registrado para este evento até o momento.
              </Text>
            </View>
          ) : (
            <View style={styles.attendanceTable}>
              <View style={styles.attendanceHeaderRow}>
                <Text style={[styles.attendanceHeaderCell, styles.colOrder]}>#</Text>
                <Text style={[styles.attendanceHeaderCell, styles.colName]}>Nome</Text>
                <Text style={[styles.attendanceHeaderCell, styles.colTime]}>Hora do check-in</Text>
              </View>
              {rows.map((row, index) => (
                <View
                  key={row.id}
                  style={[styles.attendanceRow, index % 2 === 1 ? styles.attendanceRowAlt : null]}
                >
                  <Text style={[styles.attendanceCell, styles.colOrder]}>{index + 1}</Text>
                  <Text style={[styles.attendanceCell, styles.colName]} numberOfLines={2}>
                    {formatShortName(row.participant_name)}
                  </Text>
                  <Text style={[styles.attendanceCell, styles.colTime]}>
                    {formatQuorumCheckinTime(row)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {isRefreshing ? <Text style={styles.refreshHint}>Atualizando lista…</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    padding: 8,
  },
  panelMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  panelTitleMuted: {
    color: '#334155',
    fontSize: 18,
    fontWeight: '800',
  },
  panelHint: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  warningText: {
    color: '#B45309',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  eventChipScroll: {
    flexGrow: 0,
    marginBottom: 8,
    maxHeight: 44,
  },
  eventChipRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  eventChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#94A3B8',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventChipSelected: {
    borderColor: '#1e3a8a',
    backgroundColor: '#DBEAFE',
  },
  eventChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  eventChipTextSelected: {
    color: '#1e3a8a',
    fontWeight: '800',
  },
  documentScroll: {
    flex: 1,
  },
  documentContent: {
    paddingBottom: 16,
  },
  document: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 12,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  documentTitle: {
    flex: 1,
    color: '#1e3a8a',
    fontSize: 17,
    fontWeight: '800',
  },
  eventNameHeading: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  metaBlock: {
    gap: 6,
  },
  metaLine: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  metaLabel: {
    fontWeight: '800',
    color: '#0f172a',
  },
  introText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
  listStateBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  listStateText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listErrorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  attendanceTable: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  attendanceHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  attendanceHeaderCell: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  attendanceRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  attendanceRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  attendanceCell: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 18,
  },
  colOrder: {
    width: 40,
    textAlign: 'center',
    fontWeight: '700',
  },
  colName: {
    flex: 1,
    minWidth: 120,
  },
  colTime: {
    width: 108,
    textAlign: 'right',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  refreshHint: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
});
