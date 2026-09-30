import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { FamilyQrCodeScanner } from '@/components/FamilyQrCodeScanner';
import { useDashboardSelectedEvent } from '@/hooks/useDashboardSelectedEvent';
import { useRoomServidorScales } from '@/hooks/useRoomServidorScales';
import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useEventRegistrationsByStatus, registrationHasCareAlert } from '@/hooks/useEventRegistrationsByStatus';
import type { EventRegistrationGroupItem } from '@/hooks/useEventRegistrationsByStatus';
import { readDashboardSelectedEventId } from '@/lib/dashboardSelectedEvent';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { normalizeFamilyCode } from '@/lib/family';
import { fetchFamilyAudienceMembers } from '@/lib/familyAudienceMembers';
import { normalizeFullNameKey } from '@/lib/fullName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { formatRoomServidorNames } from '@/lib/roomServidorScales';
import { openRoomContactWhatsapp } from '@/lib/whatsapp';
import { requestConfirmDialog } from '@/lib/confirmDialogHost';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type GroupedRoomKey = 'KIDS' | 'TEENS';

type GroupedRoomConfig = {
  key: GroupedRoomKey;
  label: string;
  checkedCount: number;
  totalCount: number;
  headerStyle: object;
};

type SalaCheckinQrAction = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

type MaintenanceSalaServidorCardProps = {
  embedded?: boolean;
  panelHeight?: number;
  minimal?: boolean;
  /** Expõe o botão do rodapé «Efetuar Check-In / Check-Out | Ler QRCode» para o CloseFooterBar. */
  onCheckinQrActionChange?: (action: SalaCheckinQrAction | null) => void;
};

const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const normalizeScannedFamilyId = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('family') ?? url.searchParams.get('familia');
    if (fromQuery?.trim()) {
      return normalizeFamilyCode(fromQuery);
    }
  } catch {
    // não é URL — usa o valor bruto
  }

  return normalizeFamilyCode(trimmed);
};

export const MaintenanceSalaServidorCard = ({
  embedded,
  panelHeight,
  minimal = false,
  onCheckinQrActionChange,
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
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [careAlertRegistration, setCareAlertRegistration] =
    useState<EventRegistrationGroupItem | null>(null);
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
    finalizeRoomRelease,
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

  const selectedEventTime = selectedEvent
    ? formatEventDateTimeLabel(selectedEvent.event_date, selectedEvent.event_end_date)
    : null;

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

  const safeKidsRegistrations = (kidsRegistrations ?? []).filter(
    (registration) => !(registration.room_released && !registration.room_entry_checked)
  );
  const safeTeensRegistrations = (teensRegistrations ?? []).filter(
    (registration) => !(registration.room_released && !registration.room_entry_checked)
  );

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

  const handleFinalizeRoom = async (roomKey: GroupedRoomKey) => {
    const canFinalize = roomKey === 'TEENS' ? canCheckInTeens : canCheckInKids;
    if (!canFinalize) {
      Alert.alert(
        'Sem permissão',
        'Somente Secretaria, Super Admin ou servidores escalados para esta sala na data do evento podem finalizar a sala.'
      );
      return;
    }

    const confirmed = await requestConfirmDialog({
      message: 'Finalizar Sala?',
      confirmLabel: 'Sim',
      cancelLabel: 'Não',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await finalizeRoomRelease(roomKey);
      Toast.show({
        type: 'success',
        text1: 'Sala finalizada',
        text2: result.message ?? 'Crianças liberadas.',
      });
      await refetchGroupedRegistrations();
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível finalizar a sala.'
      );
    }
  };

  const handleFamilyQrScan = useCallback(
    async (rawValue: string) => {
      setQrScannerOpen(false);

      if (!canCheckInSelectedRoom || !selectedGroupedRoomConfig) {
        Toast.show({
          type: 'error',
          text1: 'Sem permissão',
          text2: 'Somente Secretaria, Super Admin ou servidores escalados podem registrar o check-in.',
        });
        return;
      }

      const familyId = normalizeScannedFamilyId(rawValue);
      if (!familyId) {
        Toast.show({
          type: 'error',
          text1: 'QR inválido',
          text2: 'Não foi possível identificar o código da família.',
        });
        return;
      }

      const roomKey = selectedGroupedRoomConfig.key;
      const roomLabel = selectedGroupedRoomConfig.label;
      const roomRegistrations =
        roomKey === 'TEENS' ? safeTeensRegistrations : safeKidsRegistrations;
      const otherRoomKey = roomKey === 'TEENS' ? 'KIDS' : 'TEENS';
      const otherRoomLabel =
        availableGroupedRooms.find((room) => room.key === otherRoomKey)?.label
        ?? (otherRoomKey === 'TEENS' ? teensRoomLabel : kidsRoomLabel);
      const otherRoomRegistrations =
        otherRoomKey === 'TEENS' ? safeTeensRegistrations : safeKidsRegistrations;

      let familyNameKeys = new Set<string>();
      try {
        const familyMembers = await fetchFamilyAudienceMembers(familyId);
        familyNameKeys = new Set(
          familyMembers
            .map((member) => normalizeFullNameKey(member.full_name))
            .filter(Boolean)
        );
      } catch {
        familyNameKeys = new Set();
      }

      const matchesFamily = (
        registration: (typeof roomRegistrations)[number]
      ) => {
        const registrationFamilyId = normalizeFamilyCode(registration.family_id);
        if (registrationFamilyId && registrationFamilyId === familyId) {
          return true;
        }
        const nameKey = normalizeFullNameKey(registration.full_name);
        return Boolean(nameKey && familyNameKeys.has(nameKey));
      };

      const matches = roomRegistrations.filter(matchesFamily);
      const otherMatches = otherRoomRegistrations.filter(matchesFamily);

      if (!matches.length) {
        const otherLiberated = otherMatches.filter(
          (registration) => registration.room_entry_checked && registration.room_released
        );
        if (otherLiberated.length) {
          Toast.show({
            type: 'info',
            text1: `Selecione ${otherRoomLabel}`,
            text2: `Há criança(s) liberada(s) nessa sala para dar baixa com o QR.`,
          });
          return;
        }

        Toast.show({
          type: 'error',
          text1: 'Nenhuma criança nesta sala',
          text2: `A família ${familyId} não tem inscritos em ${roomLabel}.`,
        });
        return;
      }

      // Baixa só quem está Liberado na sala selecionada; check-in quem ainda não entrou.
      const toCheckOut = matches.filter(
        (registration) => registration.room_entry_checked && registration.room_released
      );
      const toCheckIn = matches.filter(
        (registration) => !registration.room_entry_checked && !registration.room_released
      );

      if (!toCheckIn.length && !toCheckOut.length) {
        Toast.show({
          type: 'info',
          text1: 'Já na sala',
          text2: `Crianças de ${familyId} em ${roomLabel} ainda não foram liberadas para retirada.`,
        });
        return;
      }

      const pendingIds = [
        ...toCheckIn.map((registration) => registration.registration_id),
        ...toCheckOut.map((registration) => registration.registration_id),
      ];

      try {
        setRoomEntryPendingIds((current) => [...current, ...pendingIds]);

        // Prioriza a baixa (Liberado) na sala ativa; depois o check-in pendente.
        for (const registration of toCheckOut) {
          await setRoomEntryChecked(registration.registration_id, false);
        }
        for (const registration of toCheckIn) {
          await setRoomEntryChecked(registration.registration_id, true);
        }

        await refetchGroupedRegistrations();

        const checkInNames = toCheckIn
          .map((registration) => formatDisplayName(registration.full_name))
          .join(', ');
        const checkOutNames = toCheckOut
          .map((registration) => formatDisplayName(registration.full_name))
          .join(', ');

        if (toCheckOut.length && !toCheckIn.length) {
          Toast.show({
            type: 'success',
            text1: `Baixa · ${roomLabel}`,
            text2: `${checkOutNames} retirados`,
          });
        } else if (toCheckIn.length && !toCheckOut.length) {
          Toast.show({
            type: 'success',
            text1: `Check-in · ${roomLabel}`,
            text2: `${checkInNames} → ${roomLabel}`,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: `${roomLabel} · Check-in / Check-out`,
            text2: `Entrada: ${checkInNames}. Baixa: ${checkOutNames}.`,
          });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Erro no QR',
          text2:
            error instanceof Error
              ? error.message
              : 'Não foi possível atualizar a entrada na sala.',
        });
      } finally {
        setRoomEntryPendingIds((current) => current.filter((id) => !pendingIds.includes(id)));
      }
    },
    [
      availableGroupedRooms,
      canCheckInSelectedRoom,
      kidsRoomLabel,
      refetchGroupedRegistrations,
      safeKidsRegistrations,
      safeTeensRegistrations,
      selectedGroupedRoomConfig,
      setRoomEntryChecked,
      teensRoomLabel,
    ]
  );

  useEffect(() => {
    if (!onCheckinQrActionChange) {
      return undefined;
    }

    if (!canCheckInSelectedRoom || !selectedGroupedRoomConfig) {
      onCheckinQrActionChange(null);
      return () => onCheckinQrActionChange(null);
    }

    onCheckinQrActionChange({
      label: 'Efetuar Check-In / Check-Out | Ler QRCode',
      accessibilityLabel: 'Efetuar Check-In / Check-Out | Ler QRCode',
      onPress: () => setQrScannerOpen(true),
    });

    return () => onCheckinQrActionChange(null);
  }, [canCheckInSelectedRoom, onCheckinQrActionChange, selectedGroupedRoomConfig]);

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
      <FamilyQrCodeScanner
        visible={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScan={(raw) => void handleFamilyQrScan(raw)}
      />
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
              const canFinalizeRoom = room.key === 'TEENS' ? canCheckInTeens : canCheckInKids;
              const showFinalizeButton = canFinalizeRoom && room.checkedCount > 0;

              return (
                <View key={room.key} style={styles.groupedAudienceSelectorItem}>
                  <TouchableOpacity
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
                  {showFinalizeButton ? (
                    <TouchableOpacity
                      style={styles.finalizeRoomButton}
                      onPress={() => void handleFinalizeRoom(room.key)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Finalizar ${room.label}`}
                    >
                      <Text style={styles.finalizeRoomButtonText}>X</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
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
                            <View
                              accessibilityLabel={
                                registration.kids_status === 'TEENS'
                                  ? 'Faixa Jovens'
                                  : 'Faixa Infantil'
                              }
                              style={[
                                styles.roomStatusDot,
                                registration.kids_status === 'TEENS'
                                  ? styles.roomStatusDotTeens
                                  : styles.roomStatusDotKids,
                              ]}
                            />
                            {registrationHasCareAlert(registration) ? (
                              <TouchableOpacity
                                style={styles.careAlertButton}
                                onPress={() => setCareAlertRegistration(registration)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel={`Alertas de cuidado de ${formatDisplayName(registration.full_name)}`}
                                hitSlop={8}
                              >
                                <FontAwesome name="exclamation-triangle" size={14} color="#DC2626" />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                          {registration.room_entry_checked ? (
                            registration.room_released ? (
                              <View
                                accessibilityLabel="Criança liberada da sala"
                                accessibilityRole="text"
                                style={[
                                  styles.roomReleasedBadge,
                                  minimal && styles.roomReleasedBadgeMinimal,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.roomReleasedBadgeText,
                                    minimal && styles.roomReleasedBadgeTextMinimal,
                                  ]}
                                >
                                  Liberado
                                </Text>
                              </View>
                            ) : (
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
                            )
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

      {careAlertRegistration ? (
        <View
          nativeID="room-care-alert-overlay"
          style={styles.careAlertOverlay}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.careAlertBackdrop}
            onPress={() => setCareAlertRegistration(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar alerta"
          />
          <View style={styles.careAlertCardShell} pointerEvents="box-none">
            <View style={[styles.careAlertCard, minimal && styles.careAlertCardMinimal]}>
              <Text style={[styles.careAlertTitle, minimal && styles.careAlertTitleMinimal]}>
                {formatDisplayName(careAlertRegistration.full_name)}
              </Text>
              <Text style={styles.careAlertSubtitle}>Informações de cuidado</Text>
              <ScrollView
                style={styles.careAlertScroll}
                contentContainerStyle={styles.careAlertScrollContent}
                nestedScrollEnabled
              >
                {careAlertRegistration.medical_food_alerts?.trim() ? (
                  <View style={styles.careAlertSection}>
                    <Text style={styles.careAlertSectionLabel}>Restrição Alimentar</Text>
                    <Text style={styles.careAlertSectionText}>
                      {careAlertRegistration.medical_food_alerts.trim()}
                    </Text>
                  </View>
                ) : null}
                {careAlertRegistration.additional_care_notes?.trim() ? (
                  <View style={styles.careAlertSection}>
                    <Text style={styles.careAlertSectionLabel}>Observações Adicionais</Text>
                    <Text style={styles.careAlertSectionText}>
                      {careAlertRegistration.additional_care_notes.trim()}
                    </Text>
                  </View>
                ) : null}
                {careAlertRegistration.special_needs?.trim() ? (
                  <View style={styles.careAlertSection}>
                    <Text style={styles.careAlertSectionLabel}>Necessidades Específicas</Text>
                    <Text style={styles.careAlertSectionText}>
                      {careAlertRegistration.special_needs.trim()}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
              <TouchableOpacity
                style={[styles.careAlertCloseButton, minimal && styles.careAlertCloseButtonMinimal]}
                onPress={() => setCareAlertRegistration(null)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Text
                  style={[
                    styles.careAlertCloseButtonText,
                    minimal && styles.careAlertCloseButtonTextMinimal,
                  ]}
                >
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
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
    position: 'relative',
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
  groupedAudienceSelectorItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '45%',
    minWidth: 0,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupedAudienceSelectorChip: {
    flex: 1,
    minWidth: 0,
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
  finalizeRoomButton: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#FCE7F3',
    flexShrink: 0,
  },
  finalizeRoomButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupedAudienceName: {
    color: '#3A96DD',
    fontSize: 15,
    textAlign: 'left',
    flexShrink: 1,
    minWidth: 0,
  },
  roomStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  roomStatusDotKids: {
    backgroundColor: '#FACC15',
  },
  roomStatusDotTeens: {
    backgroundColor: '#EF4444',
  },
  careAlertButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    flexShrink: 0,
  },
  careAlertOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    ...(Platform.OS === 'web'
      ? { position: 'absolute' as const }
      : null),
  },
  careAlertBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  careAlertCardShell: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  careAlertCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 12,
  },
  careAlertCardMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
  },
  careAlertTitle: {
    color: '#DC2626',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  careAlertTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  careAlertSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -4,
  },
  careAlertScroll: {
    flexGrow: 0,
    maxHeight: 280,
  },
  careAlertScrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  careAlertSection: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  careAlertSectionLabel: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  careAlertSectionText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  careAlertCloseButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  careAlertCloseButtonMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  careAlertCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  careAlertCloseButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
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
  roomReleasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FCE7F3',
    borderWidth: 1,
    borderColor: '#F9A8D4',
    flexShrink: 0,
  },
  roomReleasedBadgeMinimal: {
    backgroundColor: '#FCE7F3',
    borderColor: '#F9A8D4',
  },
  roomReleasedBadgeText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
  },
  roomReleasedBadgeTextMinimal: {
    color: '#DC2626',
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
