import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { useDashboardSelectedEvent } from '@/hooks/useDashboardSelectedEvent';
import { useRoomMonitorScales } from '@/hooks/useRoomMonitorScales';
import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { useEventRegistrationsByStatus } from '@/hooks/useEventRegistrationsByStatus';
import { readDashboardSelectedEventId } from '@/lib/dashboardSelectedEvent';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { loadSessionProfile } from '@/lib/loadSessionProfile';
import { formatRoomMonitorNames } from '@/lib/roomMonitorScales';
import { openRoomContactWhatsapp } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type GroupedRoomKey = 'KIDS' | 'TEENS';

type GroupedRoomConfig = {
  key: GroupedRoomKey;
  label: string;
  checkedCount: number;
  totalCount: number;
  headerStyle: object;
  dotStyle: object;
};

type MaintenanceSalaMonitorCardProps = {
  embedded?: boolean;
  panelHeight?: number;
};

const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export const MaintenanceSalaMonitorCard = ({
  embedded,
  panelHeight,
}: MaintenanceSalaMonitorCardProps) => {
  const {
    selectedEvent,
    selectedEventId,
    loading: loadingEvents,
    error: eventsError,
    refetch: refetchActiveEvents,
  } = useDashboardSelectedEvent({ enablePolling: false });

  const [selectedGroupedRoom, setSelectedGroupedRoom] = useState<GroupedRoomKey | null>(null);
  const [roomEntryPendingIds, setRoomEntryPendingIds] = useState<string[]>([]);
  const [operatorProfile, setOperatorProfile] = useState<{
    id: string | null;
    fullName: string | null;
  }>({ id: null, fullName: null });

  const {
    kidsRegistrations,
    teensRegistrations,
    loading: loadingGroupedRegistrations,
    error: groupedRegistrationsError,
    refetch: refetchGroupedRegistrations,
    setRoomEntryChecked,
  } = useEventRegistrationsByStatus(selectedEventId);

  const {
    kidsMonitorNames,
    teensMonitorNames,
    canCheckInKids,
    canCheckInTeens,
    loading: loadingRoomMonitors,
    refetch: refetchRoomMonitors,
  } = useRoomMonitorScales(selectedEvent?.event_date, {
    profileFullName: operatorProfile.fullName,
    profileId: operatorProfile.id,
  });

  useFocusEffect(
    useCallback(() => {
      void readDashboardSelectedEventId();
      void refetchActiveEvents();
      void refetchGroupedRegistrations();
      void refetchRoomMonitors();
      void loadSessionProfile().then((sessionProfile) => {
        setOperatorProfile({
          id: sessionProfile?.id?.trim() || null,
          fullName: sessionProfile?.full_name?.trim() || null,
        });
      });
    }, [refetchActiveEvents, refetchGroupedRegistrations, refetchRoomMonitors])
  );

  const selectedEventTime = selectedEvent ? formatEventDateTimeLabel(selectedEvent.event_date) : null;

  const capacityRatio =
    selectedEvent?.max_capacity && selectedEvent.max_capacity > 0
      ? Math.min(selectedEvent.registeredCount / selectedEvent.max_capacity, 1)
      : 0;

  const capacityFillColor =
    capacityRatio >= 0.85 ? '#0284c7' : capacityRatio >= 0.6 ? '#06b6d4' : '#67e8f9';

  const safeKidsRegistrations = kidsRegistrations ?? [];
  const safeTeensRegistrations = teensRegistrations ?? [];

  const kidsCheckedCount = safeKidsRegistrations.filter(
    (registration) => registration.room_entry_checked
  ).length;
  const teensCheckedCount = safeTeensRegistrations.filter(
    (registration) => registration.room_entry_checked
  ).length;

  const availableGroupedRooms: GroupedRoomConfig[] = [];

  if (selectedEvent?.kids_room) {
    availableGroupedRooms.push({
      key: 'KIDS',
      label: 'IBN KIDS',
      checkedCount: kidsCheckedCount,
      totalCount: kidsRegistrations.length,
      headerStyle: styles.groupedAudienceHeaderKids,
      dotStyle: styles.groupedAudienceDotKids,
    });
  }

  if (selectedEvent?.teens_room) {
    availableGroupedRooms.push({
      key: 'TEENS',
      label: 'IBN TEENS',
      checkedCount: teensCheckedCount,
      totalCount: safeTeensRegistrations.length,
      headerStyle: styles.groupedAudienceHeaderTeens,
      dotStyle: styles.groupedAudienceDotTeens,
    });
  }

  const selectedGroupedRoomConfig =
    availableGroupedRooms.find((room) => room.key === selectedGroupedRoom)
    ?? availableGroupedRooms[0]
    ?? null;

  const visibleGroupedRegistrations =
    selectedGroupedRoomConfig?.key === 'TEENS' ? safeTeensRegistrations : safeKidsRegistrations;

  const canCheckInSelectedRoom =
    selectedGroupedRoomConfig?.key === 'TEENS' ? canCheckInTeens : canCheckInKids;

  useEffect(() => {
    setSelectedGroupedRoom((current) => {
      if (!availableGroupedRooms.length) {
        return null;
      }

      if (current && availableGroupedRooms.some((room) => room.key === current)) {
        return current;
      }

      return availableGroupedRooms[0].key;
    });
  }, [
    selectedEventId,
    selectedEvent?.kids_room,
    selectedEvent?.teens_room,
    safeKidsRegistrations.length,
    safeTeensRegistrations.length,
  ]);

  const handleRoomEntryToggle = async (registrationId: string, checked: boolean) => {
    if (!canCheckInSelectedRoom) {
      Alert.alert(
        'Sem permissão',
        'Somente monitores escalados para esta sala na data do evento podem registrar o check-in.'
      );
      return;
    }

    try {
      setRoomEntryPendingIds((current) => [...current, registrationId]);
      await setRoomEntryChecked(registrationId, checked);
      await refetchGroupedRegistrations();
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível atualizar a entrada na sala.'
      );
    } finally {
      setRoomEntryPendingIds((current) => current.filter((id) => id !== registrationId));
    }
  };

  const isLoading = loadingEvents || loadingGroupedRegistrations || loadingRoomMonitors;
  const hasSalaResources = Boolean(selectedEvent?.kids_room || selectedEvent?.teens_room);

  return (
    <View
      style={[
        styles.root,
        embedded && styles.rootEmbedded,
        panelHeight ? { height: panelHeight } : null,
      ]}
    >
      {embedded ? (
        <View style={styles.embeddedCardHeader}>
          <Text style={maintenancePanelStyles.panelTitle}>Sala(s) - Check In</Text>
          <View style={maintenancePanelStyles.panelSubtitleSpacer} />
        </View>
      ) : null}

      <View style={[styles.contentBody, embedded && styles.contentBodyEmbedded]}>
      <View style={styles.eventHero}>
        <Text style={styles.eventHeroLabel}>Evento ativo (card 1 — Agenda)</Text>
        {selectedEvent ? (
          <View style={styles.eventHeroRow}>
            <View style={styles.eventHeroSummary}>
              <Text style={styles.eventHeroName} numberOfLines={2}>
                {selectedEvent.name}
              </Text>
              {selectedEventTime ? (
                <Text style={styles.eventHeroMeta}>{selectedEventTime}</Text>
              ) : null}
              {selectedEvent.event_local ? (
                <Text style={styles.eventHeroMeta}>{selectedEvent.event_local}</Text>
              ) : null}
              {selectedEvent.kids_room || selectedEvent.teens_room ? (
                <View style={styles.eventHeroRoomRow}>
                  {selectedEvent.kids_room ? (
                    <View style={[styles.eventHeroRoomBadge, styles.eventHeroRoomBadgeKids]}>
                      <View style={[styles.eventRoomDot, styles.eventRoomDotKids]} />
                      <Text style={styles.eventHeroRoomText}>IBN Kids</Text>
                    </View>
                  ) : null}
                  {selectedEvent.teens_room ? (
                    <View style={[styles.eventHeroRoomBadge, styles.eventHeroRoomBadgeTeens]}>
                      <View style={[styles.eventRoomDot, styles.eventRoomDotTeens]} />
                      <Text style={styles.eventHeroRoomText}>IBN Teens</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={styles.eventHeroCapacity}>
              <Text style={styles.eventHeroLabel}>Vagas</Text>
              {eventsError ? (
                <Text style={styles.capacityPlaceholder}>--</Text>
              ) : selectedEvent.remainingCapacity !== null ? (
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
              ) : (
                <Text style={styles.capacityPlaceholder}>--</Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.placeholderText}>
            Nenhum evento ativo no dashboard. Selecione um evento no card Agenda da Família.
          </Text>
        )}
      </View>

      {isLoading ? (
        <CardLoadingState lines={4} />
      ) : eventsError ? (
        <Text style={styles.errorText}>{eventsError.message}</Text>
      ) : groupedRegistrationsError ? (
        <Text style={styles.errorText}>{groupedRegistrationsError.message}</Text>
      ) : !selectedEvent ? null : !hasSalaResources ? (
        <Text style={styles.placeholderText}>
          O evento selecionado no dashboard não possui salas Kids ou Teens ativas.
        </Text>
      ) : (
        <View style={styles.groupedAudienceSections}>
          <View style={styles.groupedAudienceSelectorRow}>
            {availableGroupedRooms.map((room) => {
              const isSelected = room.key === selectedGroupedRoomConfig?.key;

              return (
                <TouchableOpacity
                  key={room.key}
                  style={[
                    styles.groupedAudienceSelectorChip,
                    isSelected ? room.headerStyle : styles.groupedAudienceSelectorChipInactive,
                    isSelected && styles.groupedAudienceSelectorChipSelected,
                  ]}
                  onPress={() => setSelectedGroupedRoom(room.key)}
                  activeOpacity={0.85}
                >
                  <View style={styles.groupedAudienceHeaderLabel}>
                    <View
                      style={[
                        styles.groupedAudienceDot,
                        room.dotStyle,
                        !isSelected && styles.groupedAudienceDotInactive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.groupedAudienceHeaderText,
                        !isSelected && styles.groupedAudienceHeaderTextInactive,
                      ]}
                    >
                      {room.label}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.groupedAudienceCountBadge,
                      isSelected
                        ? styles.groupedAudienceCountBadgeActive
                        : styles.groupedAudienceCountBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupedAudienceCountText,
                        !isSelected && styles.groupedAudienceCountTextInactive,
                      ]}
                    >
                      {`${room.checkedCount}/${room.totalCount}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.groupedAudienceMonitorNamesRow}>
            {availableGroupedRooms.map((room) => (
              <View key={`${room.key}-monitors`} style={styles.groupedAudienceMonitorNamesColumn}>
                <Text style={styles.groupedAudienceMonitorNamesLabel}>Monitores</Text>
                <Text style={styles.groupedAudienceMonitorNamesText} numberOfLines={2}>
                  {formatRoomMonitorNames(
                    room.key === 'TEENS' ? teensMonitorNames : kidsMonitorNames
                  )}
                </Text>
              </View>
            ))}
          </View>

          {!canCheckInSelectedRoom ? (
            <Text style={styles.roomMonitorRestrictionText}>
              Você não está escalado como monitor desta sala na data do evento. O check-in está
              bloqueado.
            </Text>
          ) : null}

          {selectedGroupedRoomConfig ? (
            <View style={styles.groupedAudienceSection}>
              <View style={styles.groupedAudienceListBox}>
                {visibleGroupedRegistrations.length ? (
                  <ScrollView
                    style={styles.groupedAudienceListScroll}
                    contentContainerStyle={styles.groupedAudienceListContent}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {visibleGroupedRegistrations.map((registration, index) => (
                      <View
                        key={`${selectedGroupedRoomConfig.key}-${registration.registration_id}-${index}`}
                        style={[
                          styles.groupedAudienceRow,
                          index === visibleGroupedRegistrations.length - 1 &&
                            styles.groupedAudienceRowLast,
                        ]}
                      >
                        <View style={styles.groupedAudienceRowContent}>
                          <TouchableOpacity
                            style={[
                              styles.roomEntryCheckbox,
                              registration.room_entry_checked && styles.roomEntryCheckboxChecked,
                              (!canCheckInSelectedRoom
                                || roomEntryPendingIds.includes(registration.registration_id)) &&
                                styles.roomEntryCheckboxDisabled,
                            ]}
                            onPress={() =>
                              void handleRoomEntryToggle(
                                registration.registration_id,
                                !registration.room_entry_checked
                              )
                            }
                            disabled={
                              !canCheckInSelectedRoom
                              || roomEntryPendingIds.includes(registration.registration_id)
                            }
                            activeOpacity={0.85}
                          >
                            {registration.room_entry_checked ? (
                              <Text style={styles.roomEntryCheckboxMark}>✓</Text>
                            ) : null}
                          </TouchableOpacity>
                          <View style={styles.groupedAudienceNameWrap}>
                            <Text style={styles.groupedAudienceName} numberOfLines={1}>
                              {formatDisplayName(registration.full_name)}
                            </Text>
                          </View>
                          <View style={styles.groupedAudienceRowAction}>
                            {registration.room_entry_checked ? (
                              <TouchableOpacity
                                style={styles.groupedAudienceWhatsappButton}
                                onPress={() =>
                                  void openRoomContactWhatsapp(registration.contact_phone)
                                }
                                disabled={!registration.contact_phone}
                                activeOpacity={0.85}
                              >
                                <FontAwesome
                                  name="whatsapp"
                                  size={20}
                                  color={registration.contact_phone ? '#25D366' : '#64748B'}
                                />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.groupedAudienceEmptyText}>
                    {selectedGroupedRoomConfig.key === 'KIDS'
                      ? 'Nenhum inscrito em IBN KIDS.'
                      : 'Nenhum inscrito em IBN TEENS.'}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.placeholderText}>Nenhuma sala disponível para este evento.</Text>
          )}
        </View>
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 10,
    padding: 16,
  },
  rootEmbedded: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 6,
  },
  embeddedCardHeader: {
    alignSelf: 'stretch',
    marginBottom: 2,
  },
  contentBody: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  contentBodyEmbedded: {
    marginTop: 4,
  },
  eventHero: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.45)',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    padding: 12,
    gap: 8,
  },
  eventHeroLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  eventHeroRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  eventHeroSummary: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  eventHeroName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  eventHeroMeta: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  eventHeroRoomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  eventHeroRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eventHeroRoomBadgeKids: {
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  eventHeroRoomBadgeTeens: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  eventRoomDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  eventRoomDotKids: {
    backgroundColor: '#FACC15',
  },
  eventRoomDotTeens: {
    backgroundColor: '#EF4444',
  },
  eventHeroRoomText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  eventHeroCapacity: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  capacityCup: {
    width: 56,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  capacityLiquid: {
    width: '100%',
  },
  capacityOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  capacityValue: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  capacityMeta: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  capacityPlaceholder: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    color: '#FFF',
    textAlign: 'center',
  },
  loader: {
    marginVertical: 24,
  },
  errorText: {
    color: '#FCA5A5',
    textAlign: 'center',
    fontSize: 14,
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  groupedAudienceSections: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  groupedAudienceSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  groupedAudienceMonitorNamesRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  groupedAudienceMonitorNamesColumn: {
    flex: 1,
    flexBasis: 0,
    gap: 2,
    minWidth: 0,
  },
  groupedAudienceMonitorNamesLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupedAudienceMonitorNamesText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  roomMonitorRestrictionText: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  groupedAudienceSelectorChip: {
    flex: 1,
    flexBasis: 0,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    height: 56,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  groupedAudienceSelectorChipInactive: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderColor: '#334155',
  },
  groupedAudienceSelectorChipSelected: {
    borderColor: '#67e8f9',
  },
  groupedAudienceHeaderKids: {
    backgroundColor: 'rgba(8, 145, 178, 0.16)',
    borderColor: 'rgba(103, 232, 249, 0.5)',
  },
  groupedAudienceHeaderTeens: {
    backgroundColor: 'rgba(8, 145, 178, 0.16)',
    borderColor: 'rgba(103, 232, 249, 0.5)',
  },
  groupedAudienceSection: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  groupedAudienceHeaderLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  groupedAudienceDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  groupedAudienceDotInactive: {
    opacity: 0.55,
  },
  groupedAudienceDotKids: {
    backgroundColor: '#FACC15',
  },
  groupedAudienceDotTeens: {
    backgroundColor: '#EF4444',
  },
  groupedAudienceHeaderText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  groupedAudienceHeaderTextInactive: {
    color: '#94A3B8',
  },
  groupedAudienceCountBadge: {
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedAudienceCountBadgeActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  groupedAudienceCountBadgeInactive: {
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  groupedAudienceCountText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  groupedAudienceCountTextInactive: {
    color: '#94A3B8',
  },
  groupedAudienceListBox: {
    flex: 1,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    overflow: 'hidden',
  },
  groupedAudienceListScroll: {
    flex: 1,
    minHeight: 0,
  },
  groupedAudienceListContent: {
    paddingVertical: 2,
  },
  groupedAudienceRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.24)',
  },
  groupedAudienceRowLast: {
    borderBottomWidth: 0,
  },
  groupedAudienceRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  groupedAudienceNameWrap: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 6,
  },
  groupedAudienceName: {
    color: '#F8FAFC',
    fontSize: 15,
    textAlign: 'left',
  },
  groupedAudienceRowAction: {
    width: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  groupedAudienceWhatsappButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedAudienceEmptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  roomEntryCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#67e8f9',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roomEntryCheckboxChecked: {
    backgroundColor: '#67e8f9',
  },
  roomEntryCheckboxDisabled: {
    opacity: 0.5,
  },
  roomEntryCheckboxMark: {
    color: '#082f49',
    fontSize: 13,
    fontWeight: '900',
  },
});
