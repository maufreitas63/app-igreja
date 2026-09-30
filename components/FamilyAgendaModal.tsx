import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { FamilyAgendaView } from '@/components/FamilyAgendaView';
import { FamilyRegistrationList } from '@/components/FamilyRegistrationList';
import { GeoCheckinStatusBanner } from '@/components/GeoCheckinStatusBanner';
import { useGhostMode } from '@/context/GhostModeContext';
import { resolveEventEnabledRoomKeys } from '@/lib/maintenanceEventForm';
import { useActiveEvents, type ActiveEventListItem } from '@/hooks/useActiveEvents';
import { useEventRegistrationsByStatus } from '@/hooks/useEventRegistrationsByStatus';
import { useLiveFamilyGeoCheckin } from '@/hooks/useLiveFamilyGeoCheckin';
import {
  familyCodeBelongsToActiveTenant,
  normalizeFamilyCode,
  resolveFamilyIdForPhone,
} from '@/lib/family';
import { fetchFamilyAudienceMembers } from '@/lib/familyAudienceMembers';
import { formatFullName, normalizeFullNameKey } from '@/lib/fullName';
import {
  KIDS_ROOM_DISPLAY_LABEL,
  TEENS_ROOM_DISPLAY_LABEL,
} from '@/lib/entityPrefixCore';
import {
  loadKidsTeensAgeLimits,
  resolveKidsTeensStatusFromBirthDate,
  type KidsTeensStatus,
} from '@/lib/kidsTeensStatus';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { writeDashboardSelectedEventId } from '@/lib/dashboardSelectedEvent';
import { NO_BOX_SHADOW } from '@/lib/boxShadow';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  buildAudienceRoomLabelIndex,
  lookupAudienceRoomLabel,
  resolveAudienceRoomLabels,
} from '@/lib/userRoomAssignment';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const KIDS_CHECKIN_QR_HINT =
  'Apresente este QR Code na recepcao da sala para confimar a entrega de seu filho no Espaço Infantil';

type KidsDeliveryRow = {
  id: string;
  fullName: string;
  roomLabel: string;
  roomStatus: KidsTeensStatus;
};

function fallbackRoomLabelForStatus(status: KidsTeensStatus): string {
  return status === 'TEENS' ? TEENS_ROOM_DISPLAY_LABEL : KIDS_ROOM_DISPLAY_LABEL;
}

function resolveKidsDeliveryRoomLabel(
  status: KidsTeensStatus,
  match: { room_key: string; room_label: string } | null
): string {
  const key = (match?.room_key ?? '').trim().toUpperCase();
  if (key === 'KIDS' || key === 'TEENS') {
    return match?.room_label?.trim() || fallbackRoomLabelForStatus(status);
  }
  return fallbackRoomLabelForStatus(status);
}

type Props = {
  visible: boolean;
  initialEventId: string | null;
  onClose: () => void;
  /** Abre a agenda no evento que precisa de audiência para o check-in por proximidade. */
  onNeedsAudience?: (eventId: string) => void;
};

/** Painel inline da Agenda da Família — entre o topo (saudação) e a barra «Encerrar sessão». */
export function FamilyAgendaModal({ visible, initialEventId, onClose, onNeedsAudience }: Props) {
  const { state: ghostModeState } = useGhostMode();
  const { width: windowWidth } = useWindowDimensions();
  const { events, loading, error, refetch } = useActiveEvents({
    enabled: true,
    enablePolling: true,
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [showKidsCheckinQr, setShowKidsCheckinQr] = useState(false);
  const [kidsDeliveryRows, setKidsDeliveryRows] = useState<KidsDeliveryRow[]>([]);
  const [profile, setProfile] = useState<{
    id: string;
    full_name?: string | null;
    phone?: string | null;
    birth_date?: string | null;
    codigo_membro?: string | null;
    family_id?: string | null;
  } | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const hasEligibleKidsForRooms = kidsDeliveryRows.length > 0;

  const kidsQrValue = useMemo(
    () => normalizeFamilyCode(familyId ?? profile?.codigo_membro ?? profile?.family_id ?? null),
    [familyId, profile?.codigo_membro, profile?.family_id]
  );
  const kidsQrSize = Math.min(220, Math.max(160, Math.floor(windowWidth * 0.42)));

  useEffect(() => {
    if (!visible) {
      setShowKidsCheckinQr(false);
      setKidsDeliveryRows([]);
      return;
    }

    setSelectedEventId(initialEventId);
  }, [initialEventId, visible]);

  useEffect(() => {
    if (!visible || !events.length) {
      return;
    }

    setSelectedEventId((current) => {
      if (current && events.some((event) => event.id === current)) {
        return current;
      }

      if (initialEventId && events.some((event) => event.id === initialEventId)) {
        return initialEventId;
      }

      return events[0]?.id ?? null;
    });
  }, [events, initialEventId, visible]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      setIsProfileLoading(true);

      try {
        // Identidade efetiva (alvo do Modo Ghost) — nunca o telefone/família do operador real.
        const sessionProfile = await loadEffectiveSessionProfile();
        const phone = sessionProfile?.phone?.trim() || null;

        if (!isMounted) {
          return;
        }

        setUserPhone(phone);
        setProfile(
          sessionProfile?.id
            ? {
                id: sessionProfile.id,
                full_name: sessionProfile.full_name,
                phone: sessionProfile.phone,
                birth_date: sessionProfile.birth_date,
                codigo_membro: sessionProfile.codigo_membro,
                family_id: sessionProfile.family_id,
              }
            : null
        );

        const profileFamilyId = normalizeFamilyCode(
          sessionProfile?.family_id ?? sessionProfile?.codigo_membro ?? null
        );
        const profileFamilyMatches =
          Boolean(profileFamilyId) && (await familyCodeBelongsToActiveTenant(profileFamilyId));
        const resolvedFamilyId = profileFamilyMatches
          ? profileFamilyId
          : phone
            ? await resolveFamilyIdForPhone(phone)
            : null;

        if (!isMounted) {
          return;
        }

        setFamilyId(resolvedFamilyId);
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [ghostModeState?.targetProfileId]);

  const selectedEvent: ActiveEventListItem | null = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  );

  const {
    kidsRegistrations,
    teensRegistrations,
    refetch: refetchRoomEntryStatus,
  } = useEventRegistrationsByStatus(selectedEvent?.id, {
    enabled: Boolean(visible && familyId && selectedEvent?.id),
    familyId,
  });

  const kidsInRoomByName = useMemo(() => {
    const checked = new Set<string>();
    for (const registration of [...kidsRegistrations, ...teensRegistrations]) {
      if (!registration.room_entry_checked) {
        continue;
      }
      const key = normalizeFullNameKey(registration.full_name);
      if (key) {
        checked.add(key);
      }
    }
    return checked;
  }, [kidsRegistrations, teensRegistrations]);

  const kidsReleasedByName = useMemo(() => {
    const released = new Set<string>();
    for (const registration of [...kidsRegistrations, ...teensRegistrations]) {
      // Liberado só enquanto ainda consta na sala; após check-out some o selo.
      if (!registration.room_released || !registration.room_entry_checked) {
        continue;
      }
      const key = normalizeFullNameKey(registration.full_name);
      if (key) {
        released.add(key);
      }
    }
    return released;
  }, [kidsRegistrations, teensRegistrations]);

  const kidsDeliveryDisplayRows = useMemo(
    () =>
      kidsDeliveryRows.map((row) => ({
        ...row,
        inRoom: kidsInRoomByName.has(normalizeFullNameKey(row.fullName)),
        released: kidsReleasedByName.has(normalizeFullNameKey(row.fullName)),
      })),
    [kidsDeliveryRows, kidsInRoomByName, kidsReleasedByName]
  );

  useEffect(() => {
    if (!visible || !selectedEvent?.id) {
      return;
    }

    void writeDashboardSelectedEventId(selectedEvent.id);
  }, [selectedEvent?.id, visible]);

  useEffect(() => {
    if (!showKidsCheckinQr || !visible) {
      return undefined;
    }

    void refetchRoomEntryStatus({ silent: true });
    const timer = setInterval(() => {
      void refetchRoomEntryStatus({ silent: true });
    }, 4000);

    return () => {
      clearInterval(timer);
    };
  }, [refetchRoomEntryStatus, showKidsCheckinQr, visible]);

  useEffect(() => {
    let active = true;

    const eventOffersKidsSalas =
      Boolean(selectedEvent?.kids_room) || Boolean(selectedEvent?.teens_room);

    if (!visible || !familyId || !eventOffersKidsSalas) {
      setKidsDeliveryRows([]);
      return undefined;
    }

    void (async () => {
      try {
        const [members, limits] = await Promise.all([
          fetchFamilyAudienceMembers(familyId),
          loadKidsTeensAgeLimits(),
        ]);

        if (!active) {
          return;
        }

        const eligible = members
          .map((member) => {
            const status = resolveKidsTeensStatusFromBirthDate(member.birth_date, limits);
            if (status === 'KIDS' && selectedEvent?.kids_room) {
              return { member, status };
            }
            if (status === 'TEENS' && selectedEvent?.teens_room) {
              return { member, status };
            }
            return null;
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry != null);

        if (!eligible.length) {
          setKidsDeliveryRows([]);
          return;
        }

        const roomRows = await resolveAudienceRoomLabels(
          eligible.map(({ member }) => member.phone),
          { familyId }
        );

        if (!active) {
          return;
        }

        const roomIndex = buildAudienceRoomLabelIndex(roomRows);
        const nextRows: KidsDeliveryRow[] = eligible.map(({ member, status }) => {
          const match = lookupAudienceRoomLabel(roomIndex, member);
          return {
            id: String(member.id),
            fullName: formatFullName(member.full_name) || 'Sem nome',
            roomLabel: resolveKidsDeliveryRoomLabel(status, match),
            roomStatus: status,
          };
        });

        nextRows.sort((a, b) =>
          a.fullName.localeCompare(b.fullName, 'pt-BR', { sensitivity: 'base' })
        );
        setKidsDeliveryRows(nextRows);
      } catch (err) {
        console.error('Erro ao verificar crianças elegíveis para salas:', err);
        if (active) {
          setKidsDeliveryRows([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    familyId,
    selectedEvent?.kids_room,
    selectedEvent?.teens_room,
    visible,
  ]);

  const capacityRatio =
    selectedEvent?.max_capacity && selectedEvent.max_capacity > 0
      ? Math.min(selectedEvent.registeredCount / selectedEvent.max_capacity, 1)
      : 0;

  const capacityFillColor =
    capacityRatio >= 0.85
      ? MINIMAL_UI.blueDark
      : capacityRatio >= 0.6
        ? MINIMAL_UI.accent
        : MINIMAL_UI.textMuted;

  const familyRegistrationSessionProfile = useMemo(
    () =>
      profile?.id
        ? {
            id: profile.id,
            full_name: profile.full_name ?? null,
            phone: profile.phone ?? userPhone,
            birth_date: profile.birth_date ?? null,
            family_id: familyId ?? profile.codigo_membro ?? null,
          }
        : null,
    [familyId, profile, userPhone]
  );

  const handleRegistrationChange = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const geo = useLiveFamilyGeoCheckin({
    events,
    preferredEventId: selectedEventId ?? selectedEvent?.id,
    familyId,
    onNeedsAudience,
    onConfirmed: handleRegistrationChange,
  });
  const { refetchGate } = geo;

  const handleAudienceChange = useCallback(async () => {
    await refetchGate();
    await handleRegistrationChange();
  }, [refetchGate, handleRegistrationChange]);

  const selectedEventIsGeoTarget = Boolean(
    selectedEvent?.id && geo.targetEvent?.id === selectedEvent.id
  );

  const registrationSection =
    familyRegistrationSessionProfile && selectedEvent ? (
      <FamilyRegistrationList
        familyId={familyId ?? ''}
        eventId={selectedEvent.id}
        eventName={selectedEvent.name}
        eventDate={selectedEvent.event_date}
        eventEndDate={selectedEvent.event_end_date}
        eventLocal={selectedEvent.event_local}
        title={`Audiência para ${selectedEvent.name}`}
        onRegistrationChange={handleAudienceChange}
        showKidsIndicator={Boolean(selectedEvent.kids_room)}
        showTeensIndicator={Boolean(selectedEvent.teens_room)}
        eventEnabledRoomKeys={resolveEventEnabledRoomKeys(selectedEvent)}
        quorumMode={selectedEvent.requer_quorum === true}
        sessionPhone={userPhone}
        sessionProfileName={profile?.full_name ?? null}
        sessionProfile={familyRegistrationSessionProfile}
        deviceCoordinates={selectedEventIsGeoTarget ? geo.lastCoordinates : null}
        skipGeofenceOnSave={selectedEventIsGeoTarget && geo.hasFamilyGeoCheckinConfirmed}
        geoCheckinStatus={selectedEventIsGeoTarget ? geo.status : 'idle'}
        geoCheckinGpsProgress={geo.gpsProgress}
        geoCheckinDistanceMeters={selectedEventIsGeoTarget ? geo.lastDistanceMeters : null}
        geoCheckinRadiusMeters={geo.geoCheckinRadiusMeters}
        minimal
        hideRoomSelos
      />
    ) : null;

  const geoHints = selectedEventIsGeoTarget ? (
    <>
      {geo.windowHint ? <Text style={styles.geoHint}>{geo.windowHint}</Text> : null}
      {geo.missingCoordinatesHint ? (
        <Text style={styles.geoHintError}>{geo.missingCoordinatesHint}</Text>
      ) : null}
      {geo.eventGeofenceError ? (
        <Text style={styles.geoHintError}>{geo.eventGeofenceError}</Text>
      ) : null}
      {geo.errorMessage ? <Text style={styles.geoHintError}>{geo.errorMessage}</Text> : null}
      {geo.geoCheckinAtivoEnabled && geo.inGeofenceWindow && !geo.hasFamilyPreCheckin ? (
        <Text style={styles.geoHint}>
          Marque a audiência abaixo. O check-in por proximidade confirma a presença ao chegar no
          local.
        </Text>
      ) : null}
    </>
  ) : null;

  const handleClose = useCallback(() => {
    if (showKidsCheckinQr) {
      setShowKidsCheckinQr(false);
      return;
    }
    onClose();
  }, [onClose, showKidsCheckinQr]);

  if (!visible) {
    if (geo.status === 'error' && geo.errorMessage) {
      return (
        <View style={styles.homeBannerWrap}>
          <Text style={styles.geoHintError}>{geo.errorMessage}</Text>
        </View>
      );
    }

    if (geo.status === 'idle') {
      return null;
    }

    return (
      <View style={styles.homeBannerWrap}>
        <GeoCheckinStatusBanner
          status={geo.status}
          gpsProgress={geo.gpsProgress}
          distanceMeters={geo.lastDistanceMeters}
          radiusMeters={geo.geoCheckinRadiusMeters}
        />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>
          {showKidsCheckinQr ? 'Espaço Infantil | Check-In / Check-Out QR' : 'Agenda da Família'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        {showKidsCheckinQr ? (
          <View style={styles.kidsQrBlock}>
            <Text style={styles.kidsQrCaption}>QR Code de Check-in</Text>
            {kidsQrValue ? (
              <>
                <View style={styles.kidsQrSurface}>
                  <QRCode
                    value={kidsQrValue}
                    size={kidsQrSize}
                    color={MINIMAL_UI.blueDark}
                    backgroundColor={MINIMAL_UI.background}
                    ecl="M"
                    quietZone={8}
                  />
                </View>
                <Text style={styles.kidsQrFamilyCode}>{kidsQrValue}</Text>
                <Text style={styles.kidsQrHint}>{KIDS_CHECKIN_QR_HINT}</Text>
              </>
            ) : (
              <Text style={styles.kidsQrHint}>
                Vincule um código de família em Dados Cadastrais para gerar o QR Code de check-in.
              </Text>
            )}

            {kidsDeliveryDisplayRows.length > 0 ? (
              <View style={styles.kidsDeliveryTable}>
                <View style={[styles.kidsDeliveryRow, styles.kidsDeliveryHeader]}>
                  <Text
                    style={[
                      styles.kidsDeliveryCell,
                      styles.kidsDeliveryName,
                      styles.kidsDeliveryHeaderText,
                    ]}
                  >
                    Criança
                  </Text>
                  <View style={styles.kidsDeliveryStatusSlot} />
                  <Text
                    style={[
                      styles.kidsDeliveryCell,
                      styles.kidsDeliveryRoom,
                      styles.kidsDeliveryHeaderText,
                    ]}
                  >
                    Sala
                  </Text>
                </View>
                {kidsDeliveryDisplayRows.map((row) => (
                  <View key={row.id} style={styles.kidsDeliveryRow}>
                    <View style={styles.kidsDeliveryNameWrap}>
                      <Text
                        style={[styles.kidsDeliveryCell, styles.kidsDeliveryName]}
                        numberOfLines={2}
                      >
                        {row.fullName}
                      </Text>
                      <View
                        accessibilityLabel={
                          row.roomStatus === 'TEENS' ? 'Faixa Jovens' : 'Faixa Infantil'
                        }
                        style={[
                          styles.kidsDeliveryRoomDot,
                          row.roomStatus === 'TEENS'
                            ? styles.kidsDeliveryRoomDotTeens
                            : styles.kidsDeliveryRoomDotKids,
                        ]}
                      />
                    </View>
                    <View style={styles.kidsDeliveryStatusSlot}>
                      {row.released ? (
                        <View
                          accessibilityLabel="Criança liberada da sala"
                          accessibilityRole="text"
                          style={styles.kidsReleasedBadge}
                        >
                          <Text style={styles.kidsReleasedBadgeText}>Liberado</Text>
                        </View>
                      ) : row.inRoom ? (
                        <View
                          accessibilityLabel="Check-in na sala concluído"
                          accessibilityRole="text"
                          style={styles.kidsInRoomBadge}
                        >
                          <FontAwesome name="sign-in" size={11} color={MINIMAL_UI.onDark} />
                          <Text style={styles.kidsInRoomBadgeText}>Na sala</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.kidsDeliveryCell, styles.kidsDeliveryRoom]}
                      numberOfLines={2}
                    >
                      {row.roomLabel}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <FamilyAgendaView
            loading={loading || isProfileLoading}
            events={events}
            selectedEvent={selectedEvent}
            eventsError={error}
            capacityFillColor={capacityFillColor}
            capacityRatio={capacityRatio}
            registrationSection={
              <>
                {geoHints}
                {registrationSection}
              </>
            }
            loginRequiredMessage={
              !familyRegistrationSessionProfile && !loading && !isProfileLoading
                ? 'Faça login para se inscrever em eventos.'
                : null
            }
          />
        )}
      </ScrollView>

      <CloseFooterBar
        onPress={handleClose}
        secondaryAction={
          showKidsCheckinQr || !hasEligibleKidsForRooms
            ? null
            : {
                label: 'Espaço Infantil | Check-In / Check-Out QR',
                onPress: () => setShowKidsCheckinQr(true),
                accessibilityLabel: 'Espaço Infantil | Check-In / Check-Out QR',
                variant: 'outline',
              }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 0,
    ...NO_BOX_SHADOW,
    overflow: 'hidden',
  },
  panelHeader: {
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
  },
  panelTitle: MINIMAL_SECTION_TITLE,
  scroll: {
    flex: 1,
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
  },
  scrollContent: {
    paddingBottom: 12,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: MINIMAL_UI.background,
  },
  homeBannerWrap: {
    width: '100%',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  geoHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    opacity: 0.88,
    marginBottom: 8,
  },
  geoHintError: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  kidsQrBlock: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  kidsQrCaption: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  kidsQrSurface: {
    backgroundColor: MINIMAL_UI.background,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kidsQrFamilyCode: {
    marginTop: 8,
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  kidsQrHint: {
    marginTop: 8,
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  kidsDeliveryTable: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 20,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: MINIMAL_UI.background,
  },
  kidsDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: MINIMAL_UI.divider,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  kidsDeliveryHeader: {
    borderTopWidth: 0,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  kidsDeliveryCell: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 18,
  },
  kidsDeliveryHeaderText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kidsDeliveryName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  kidsDeliveryNameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kidsDeliveryRoomDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  kidsDeliveryRoomDotKids: {
    backgroundColor: '#FACC15',
  },
  kidsDeliveryRoomDotTeens: {
    backgroundColor: '#EF4444',
  },
  kidsDeliveryStatusSlot: {
    width: 78,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  kidsDeliveryRoom: {
    width: 64,
    flexShrink: 0,
    textAlign: 'right',
    fontWeight: '600',
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
  },
  kidsInRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  kidsInRoomBadgeText: {
    color: MINIMAL_UI.onDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  kidsReleasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FCE7F3',
    borderWidth: 1,
    borderColor: '#F9A8D4',
  },
  kidsReleasedBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
