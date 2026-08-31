import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { useDashboardSelectedEvent } from '@/hooks/useDashboardSelectedEvent';
import { useRoomServidorScales } from '@/hooks/useRoomServidorScales';
import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useEventRegistrationsByStatus } from '@/hooks/useEventRegistrationsByStatus';
import { readDashboardSelectedEventId } from '@/lib/dashboardSelectedEvent';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { formatRoomServidorNames } from '@/lib/roomServidorScales';
import { openRoomContactWhatsapp } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
};

type MaintenanceSalaServidorCardProps = {
  embedded?: boolean;
  panelHeight?: number;
  minimal?: boolean;
};

const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export const MaintenanceSalaServidorCard = ({
  embedded,
  panelHeight,
  minimal = false,
}: MaintenanceSalaServidorCardProps) => {
  const {
    kidsRoomLabel,
    teensRoomLabel,
    kidsRoomBadgeLabel,
    teensRoomBadgeLabel,
  } = useRoomDisplayLabels();
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
    kidsServidorNames,
    teensServidorNames,
    canCheckInKids,
    canCheckInTeens,
    loading: loadingRoomServidores,
    refetch: refetchRoomServidores,
  } = useRoomServidorScales(selectedEvent?.event_date, {
    profileFullName: operatorProfile.fullName,
    profileId: operatorProfile.id,
  });

  useFocusEffect(
    useCallback(() => {
      void readDashboardSelectedEventId();
      void refetchActiveEvents();
      void refetchGroupedRegistrations();
      void refetchRoomServidores();
      void loadEffectiveSessionProfile().then((sessionProfile) => {
        setOperatorProfile({
          id: sessionProfile?.id?.trim() || null,
          fullName: sessionProfile?.full_name?.trim() || null,
        });
      });
    }, [refetchActiveEvents, refetchGroupedRegistrations, refetchRoomServidores])
  );

  const selectedEventTime = selectedEvent ? formatEventDateTimeLabel(selectedEvent.event_date) : null;

  const capacityRatio =
    selectedEvent?.max_capacity && selectedEvent.max_capacity > 0
      ? Math.min(selectedEvent.registeredCount / selectedEvent.max_capacity, 1)
      : 0;

  const capacityFillColor = minimal
    ? capacityRatio >= 0.85
      ? MINIMAL_UI.blueDark
      : capacityRatio >= 0.6
        ? MINIMAL_UI.accent
        : MINIMAL_UI.textMuted
    : capacityRatio >= 0.85
      ? '#0284c7'
      : capacityRatio >= 0.6
        ? '#06b6d4'
        : '#67e8f9';

  const safeKidsRegistrations = kidsRegistrations ?? [];
  const safeTeensRegistrations = teensRegistrations ?? [];

  const kidsCheckedCount = safeKidsRegistrations.filter(
    (registration) => registration.room_entry_checked
  ).length;
  const teensCheckedCount = safeTeensRegistrations.filter(
    (registration) => registration.room_entry_checked
  ).length;

  const availableGroupedRooms = useMemo(() => {
    const rooms: GroupedRoomConfig[] = [];

    if (selectedEvent?.kids_room) {
      rooms.push({
        key: 'KIDS',
        label: kidsRoomLabel,
        checkedCount: kidsCheckedCount,
        totalCount: kidsRegistrations.length,
        headerStyle: styles.groupedAudienceHeaderKids,
      });
    }

    if (selectedEvent?.teens_room) {
      rooms.push({
        key: 'TEENS',
        label: teensRoomLabel,
        checkedCount: teensCheckedCount,
        totalCount: safeTeensRegistrations.length,
        headerStyle: styles.groupedAudienceHeaderTeens,
      });
    }

    return rooms;
  }, [
    kidsCheckedCount,
    kidsRegistrations.length,
    kidsRoomLabel,
    selectedEvent?.kids_room,
    selectedEvent?.teens_room,
    teensCheckedCount,
    safeTeensRegistrations.length,
    teensRoomLabel,
  ]);

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
  }, [availableGroupedRooms]);

  const handleRoomEntryToggle = async (registrationId: string, checked: boolean) => {
    if (!canCheckInSelectedRoom) {
      Alert.alert(
        'Sem permissão',
        'Somente Secretaria, Super Admin ou servidores escalados para esta sala na data do evento podem registrar o check-in.'
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

  const isLoading = loadingEvents || loadingGroupedRegistrations || loadingRoomServidores;
  const hasSalaResources = Boolean(selectedEvent?.kids_room || selectedEvent?.teens_room);

  return (
    <View
      style={[
        styles.root,
        embedded && styles.rootEmbedded,
        minimal && styles.rootMinimal,
        panelHeight ? { height: panelHeight } : null,
      ]}
    >
      {embedded && !minimal ? (
        <View style={styles.embeddedCardHeader}>
          <Text style={maintenancePanelStyles.panelTitle}>Sala(s) - Check In</Text>
          <View style={maintenancePanelStyles.panelSubtitleSpacer} />
        </View>
      ) : null}

      <View
        style={[
          styles.contentBody,
          embedded && styles.contentBodyEmbedded,
          minimal && styles.contentBodyMinimal,
        ]}
      >
      <View style={[styles.eventHero, minimal && styles.eventHeroMinimal]}>
        <Text style={[styles.eventHeroLabel, minimal && styles.eventHeroLabelMinimal]}>
          Evento ativo (card 1 — Agenda)
        </Text>
        {selectedEvent ? (
          <View style={styles.eventHeroRow}>
            <View style={styles.eventHeroSummary}>
              <Text
                style={[styles.eventHeroName, minimal && styles.eventHeroNameMinimal]}
                numberOfLines={2}
              >
                {selectedEvent.name}
              </Text>
              {selectedEventTime ? (
                <Text style={[styles.eventHeroMeta, minimal && styles.eventHeroMetaMinimal]}>
                  {selectedEventTime}
                </Text>
              ) : null}
              {selectedEvent.event_local ? (
                <Text style={[styles.eventHeroMeta, minimal && styles.eventHeroMetaMinimal]}>
                  {selectedEvent.event_local}
                </Text>
              ) : null}
              {selectedEvent.kids_room || selectedEvent.teens_room ? (
                <View style={styles.eventHeroRoomRow}>
                  {selectedEvent.kids_room ? (
                    <View
                      style={[
                        styles.eventHeroRoomBadge,
                        styles.eventHeroRoomBadgeUnified,
                        minimal && styles.eventHeroRoomBadgeUnifiedMinimal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.eventHeroRoomText,
                          minimal && styles.eventHeroRoomTextMinimal,
                        ]}
                      >
                        {kidsRoomBadgeLabel}
                      </Text>
                    </View>
                  ) : null}
                  {selectedEvent.teens_room ? (
                    <View
                      style={[
                        styles.eventHeroRoomBadge,
                        styles.eventHeroRoomBadgeUnified,
                        minimal && styles.eventHeroRoomBadgeUnifiedMinimal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.eventHeroRoomText,
                          minimal && styles.eventHeroRoomTextMinimal,
                        ]}
                      >
                        {teensRoomBadgeLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={styles.eventHeroCapacity}>
              <Text style={[styles.eventHeroLabel, minimal && styles.eventHeroLabelMinimal]}>
                Vagas
              </Text>
              {eventsError ? (
                <Text style={[styles.capacityPlaceholder, minimal && styles.capacityPlaceholderMinimal]}>
                  --
                </Text>
              ) : selectedEvent.remainingCapacity !== null ? (
                <View style={[styles.capacityCup, minimal && styles.capacityCupMinimal]}>
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
                    <Text
                      style={[styles.capacityValue, minimal && styles.capacityValueMinimal]}
                    >
                      ({selectedEvent.remainingCapacity})
                    </Text>
                    <Text style={[styles.capacityMeta, minimal && styles.capacityMetaMinimal]}>
                      {selectedEvent.registeredCount}/{selectedEvent.max_capacity}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.capacityPlaceholder, minimal && styles.capacityPlaceholderMinimal]}>
                  --
                </Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={[styles.placeholderText, minimal && styles.placeholderTextMinimal]}>
            Nenhum evento ativo no dashboard. Selecione um evento no card Agenda da Família.
          </Text>
        )}
      </View>

      {isLoading ? (
        <CardLoadingState lines={4} minimal={minimal} />
      ) : eventsError ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{eventsError.message}</Text>
      ) : groupedRegistrationsError ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>
          {groupedRegistrationsError.message}
        </Text>
      ) : !selectedEvent ? null : !hasSalaResources ? (
        <Text style={[styles.placeholderText, minimal && styles.placeholderTextMinimal]}>
          O evento selecionado no dashboard não possui salas Infantil ou Jovens ativas.
        </Text>
      ) : (
        <View style={[styles.groupedAudienceSections, minimal && styles.groupedAudienceSectionsMinimal]}>
          <View style={styles.groupedAudienceSelectorRow}>
            {availableGroupedRooms.map((room) => {
              const isSelected = room.key === selectedGroupedRoomConfig?.key;

              return (
                <TouchableOpacity
                  key={room.key}
                  style={[
                    styles.groupedAudienceSelectorChip,
                    minimal && styles.groupedAudienceSelectorChipMinimal,
                    isSelected
                      ? minimal
                        ? styles.groupedAudienceSelectorChipSelectedMinimal
                        : room.headerStyle
                      : minimal
                        ? styles.groupedAudienceSelectorChipInactiveMinimal
                        : styles.groupedAudienceSelectorChipInactive,
                    isSelected && !minimal && styles.groupedAudienceSelectorChipSelected,
                  ]}
                  onPress={() => setSelectedGroupedRoom(room.key)}
                  activeOpacity={0.85}
                >
                  <View style={styles.groupedAudienceHeaderLabel}>
                    <Text
                      style={[
                        styles.groupedAudienceHeaderText,
                        minimal && styles.groupedAudienceHeaderTextMinimal,
                        isSelected && minimal && styles.groupedAudienceHeaderTextSelectedMinimal,
                        !isSelected && styles.groupedAudienceHeaderTextInactive,
                        !isSelected && minimal && styles.groupedAudienceHeaderTextInactiveMinimal,
                      ]}
                      numberOfLines={1}
                    >
                      {room.label}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.groupedAudienceCountBadge,
                      minimal && styles.groupedAudienceCountBadgeMinimal,
                      isSelected
                        ? minimal
                          ? styles.groupedAudienceCountBadgeActiveMinimal
                          : styles.groupedAudienceCountBadgeActive
                        : minimal
                          ? styles.groupedAudienceCountBadgeInactiveMinimal
                          : styles.groupedAudienceCountBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupedAudienceCountText,
                        minimal && styles.groupedAudienceCountTextMinimal,
                        isSelected && minimal && styles.groupedAudienceCountTextSelectedMinimal,
                        !isSelected && styles.groupedAudienceCountTextInactive,
                        !isSelected && minimal && styles.groupedAudienceCountTextInactiveMinimal,
                      ]}
                    >
                      {`${room.checkedCount}/${room.totalCount}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.groupedAudienceServidorNamesRow}>
            {availableGroupedRooms.map((room) => (
              <View key={`${room.key}-servidores`} style={styles.groupedAudienceServidorNamesColumn}>
                <Text
                  style={[
                    styles.groupedAudienceServidorNamesLabel,
                    minimal && styles.groupedAudienceServidorNamesLabelMinimal,
                  ]}
                >
                  Servidores
                </Text>
                <Text
                  style={[
                    styles.groupedAudienceServidorNamesText,
                    minimal && styles.groupedAudienceServidorNamesTextMinimal,
                  ]}
                  numberOfLines={2}
                >
                  {formatRoomServidorNames(
                    room.key === 'TEENS' ? teensServidorNames : kidsServidorNames
                  )}
                </Text>
              </View>
            ))}
          </View>

          {!canCheckInSelectedRoom ? (
            <Text
              style={[
                styles.roomServidorRestrictionText,
                minimal && styles.roomServidorRestrictionTextMinimal,
              ]}
            >
              Você não está escalado como servidor desta sala na data do evento. Secretaria e Super
              Admin podem fazer o check-in mesmo sem escala.
            </Text>
          ) : null}

          {selectedGroupedRoomConfig ? (
            <View style={styles.groupedAudienceSection}>
              <View
                style={[
                  styles.groupedAudienceListBox,
                  minimal && styles.groupedAudienceListBoxMinimal,
                ]}
              >
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
                          minimal && styles.groupedAudienceRowMinimal,
                          index === visibleGroupedRegistrations.length - 1 &&
                            styles.groupedAudienceRowLast,
                        ]}
                      >
                        <View style={styles.groupedAudienceRowContent}>
                          <TouchableOpacity
                            style={[
                              styles.roomEntryCheckbox,
                              minimal && styles.roomEntryCheckboxMinimal,
                              registration.room_entry_checked && styles.roomEntryCheckboxChecked,
                              registration.room_entry_checked &&
                                minimal &&
                                styles.roomEntryCheckboxCheckedMinimal,
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
                              <Text
                                style={[
                                  styles.roomEntryCheckboxMark,
                                  minimal && styles.roomEntryCheckboxMarkMinimal,
                                ]}
                              >
                                ✓
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                          <View style={styles.groupedAudienceNameWrap}>
                            <Text
                              style={[
                                styles.groupedAudienceName,
                                minimal && styles.groupedAudienceNameMinimal,
                              ]}
                              numberOfLines={1}
                            >
                              {formatDisplayName(registration.full_name)}
                            </Text>
                          </View>
                          {registration.room_entry_checked ? (
                            <View
                              accessibilityLabel="Check-in na sala concluído"
                              accessibilityRole="text"
                              style={[
                                styles.roomCheckInBadge,
                                minimal && styles.roomCheckInBadgeMinimal,
                              ]}
                            >
                              <FontAwesome
                                name="sign-in"
                                size={11}
                                color={minimal ? MINIMAL_UI.onDark : '#B45309'}
                              />
                              <Text
                                style={[
                                  styles.roomCheckInBadgeText,
                                  minimal && styles.roomCheckInBadgeTextMinimal,
                                ]}
                              >
                                Na sala
                              </Text>
                            </View>
                          ) : null}
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
                                  color={
                                    registration.contact_phone
                                      ? minimal
                                        ? '#16A34A'
                                        : '#25D366'
                                      : minimal
                                        ? MINIMAL_UI.textMuted
                                        : '#64748B'
                                  }
                                />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text
                    style={[
                      styles.groupedAudienceEmptyText,
                      minimal && styles.groupedAudienceEmptyTextMinimal,
                    ]}
                  >
                    {selectedGroupedRoomConfig.key === 'KIDS'
                      ? `Nenhum inscrito em ${kidsRoomLabel}.`
                      : `Nenhum inscrito em ${teensRoomLabel}.`}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={[styles.placeholderText, minimal && styles.placeholderTextMinimal]}>
              Nenhuma sala disponível para este evento.
            </Text>
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
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  rootEmbedded: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 6,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  embeddedCardHeader: {
    alignSelf: 'stretch',
    marginBottom: 2,
  },
  contentBody: {
    flex: 1,
    minHeight: 0,
    gap: 10,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  contentBodyEmbedded: {
    marginTop: 4,
  },
  contentBodyMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  eventHero: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.45)',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    padding: 12,
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  eventHeroLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  eventHeroRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  eventHeroSummary: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    maxWidth: '100%',
  },
  eventHeroName: {
    color: '#3A96DD',
    fontSize: 16,
    fontWeight: '800',
  },
  eventHeroMeta: {
    color: '#3A96DD',
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
    justifyContent: 'center',
    gap: 0,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eventHeroRoomBadgeUnified: {
    backgroundColor: 'rgba(30, 64, 175, 0.10)',
    borderColor: 'rgba(30, 64, 175, 0.35)',
  },
  eventHeroRoomText: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  eventHeroCapacity: {
    width: 72,
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  capacityCup: {
    width: 56,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
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
    color: '#3A96DD',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  capacityMeta: {
    color: '#3A96DD',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  capacityPlaceholder: {
    color: 'rgba(58, 150, 221, 0.82)',
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
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  groupedAudienceSections: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  groupedAudienceSectionsMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  groupedAudienceSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  groupedAudienceServidorNamesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  groupedAudienceServidorNamesColumn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '45%',
    gap: 2,
    minWidth: 0,
    maxWidth: '100%',
  },
  groupedAudienceServidorNamesLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupedAudienceServidorNamesText: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  roomServidorRestrictionText: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  groupedAudienceSelectorChip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '45%',
    minWidth: 0,
    maxWidth: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    overflow: 'hidden',
  },
  groupedAudienceSelectorChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(52, 211, 153, 0.35)',
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
  groupedAudienceHeaderText: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    flexShrink: 1,
    minWidth: 0,
  },
  groupedAudienceHeaderTextInactive: {
    color: 'rgba(58, 150, 221, 0.82)',
  },
  groupedAudienceCountBadge: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  groupedAudienceCountBadgeActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  groupedAudienceCountBadgeInactive: {
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  groupedAudienceCountText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  groupedAudienceCountTextInactive: {
    color: 'rgba(58, 150, 221, 0.82)',
  },
  groupedAudienceListBox: {
    flex: 1,
    minHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
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
    color: '#3A96DD',
    fontSize: 15,
    textAlign: 'left',
  },
  roomCheckInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    flexShrink: 0,
  },
  roomCheckInBadgeMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  roomCheckInBadgeText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  roomCheckInBadgeTextMinimal: {
    color: MINIMAL_UI.onDark,
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
    color: 'rgba(58, 150, 221, 0.82)',
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
  rootMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 4,
    backgroundColor: MINIMAL_UI.background,
  },
  eventHeroMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  eventHeroLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  eventHeroNameMinimal: {
    color: MINIMAL_UI.text,
  },
  eventHeroMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  eventHeroRoomBadgeUnifiedMinimal: {
    backgroundColor: 'rgba(30, 64, 175, 0.10)',
    borderColor: 'rgba(30, 64, 175, 0.35)',
  },
  eventHeroRoomTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  capacityCupMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  capacityValueMinimal: {
    color: MINIMAL_UI.text,
  },
  capacityMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  capacityPlaceholderMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  placeholderTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  groupedAudienceSelectorChipMinimal: {
    borderRadius: 12,
  },
  groupedAudienceSelectorChipInactiveMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
  },
  groupedAudienceSelectorChipSelectedMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  groupedAudienceHeaderTextMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  groupedAudienceHeaderTextSelectedMinimal: {
    color: MINIMAL_UI.onDark,
  },
  groupedAudienceHeaderTextInactiveMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  groupedAudienceCountBadgeMinimal: {
    minWidth: 48,
  },
  groupedAudienceCountBadgeActiveMinimal: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  groupedAudienceCountBadgeInactiveMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  groupedAudienceCountTextMinimal: {
    color: MINIMAL_UI.text,
  },
  groupedAudienceCountTextSelectedMinimal: {
    color: MINIMAL_UI.onDark,
  },
  groupedAudienceCountTextInactiveMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  groupedAudienceServidorNamesLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  groupedAudienceServidorNamesTextMinimal: {
    color: MINIMAL_UI.text,
  },
  roomServidorRestrictionTextMinimal: {
    color: '#B45309',
  },
  groupedAudienceListBoxMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  groupedAudienceRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  groupedAudienceNameMinimal: {
    color: MINIMAL_UI.text,
  },
  groupedAudienceEmptyTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  roomEntryCheckboxMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  roomEntryCheckboxCheckedMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  roomEntryCheckboxMarkMinimal: {
    color: MINIMAL_UI.onDark,
  },
});
