import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { FamilyAgendaView } from '@/components/FamilyAgendaView';
import { FamilyRegistrationList } from '@/components/FamilyRegistrationList';
import { GeoCheckinStatusBanner } from '@/components/GeoCheckinStatusBanner';
import { useGhostMode } from '@/context/GhostModeContext';
import { resolveEventEnabledRoomKeys } from '@/lib/maintenanceEventForm';
import { useActiveEvents, type ActiveEventListItem } from '@/hooks/useActiveEvents';
import { useLiveFamilyGeoCheckin } from '@/hooks/useLiveFamilyGeoCheckin';
import { resolveFamilyIdForPhone, normalizeFamilyCode } from '@/lib/family';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { writeDashboardSelectedEventId } from '@/lib/dashboardSelectedEvent';
import { NO_BOX_SHADOW } from '@/lib/boxShadow';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const { events, loading, error, refetch } = useActiveEvents({
    enabled: true,
    enablePolling: true,
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    id: string;
    full_name?: string | null;
    phone?: string | null;
    birth_date?: string | null;
    codigo_membro?: string | null;
    family_id?: string | null;
  } | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
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

        const resolvedFamilyId =
          normalizeFamilyCode(
            sessionProfile?.family_id ?? sessionProfile?.codigo_membro ?? null
          ) || (phone ? await resolveFamilyIdForPhone(phone) : null);

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

  useEffect(() => {
    if (!visible || !selectedEvent?.id) {
      return;
    }

    void writeDashboardSelectedEventId(selectedEvent.id);
  }, [selectedEvent?.id, visible]);

  const capacityRatio =
    selectedEvent?.max_capacity && selectedEvent.max_capacity > 0
      ? Math.min(selectedEvent.registeredCount / selectedEvent.max_capacity, 1)
      : 0;

  const capacityFillColor =
    capacityRatio >= 0.85 ? '#0284c7' : capacityRatio >= 0.6 ? '#06b6d4' : '#67e8f9';

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

  const handleAudienceChange = useCallback(async () => {
    await geo.refetchGate();
    await handleRegistrationChange();
  }, [geo.refetchGate, handleRegistrationChange]);

  const selectedEventIsGeoTarget = Boolean(
    selectedEvent?.id && geo.targetEvent?.id === selectedEvent.id
  );

  const registrationSection =
    familyRegistrationSessionProfile && selectedEvent ? (
      <FamilyRegistrationList
        familyId={familyId ?? ''}
        eventId={selectedEvent.id}
        eventName={selectedEvent.name}
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
        <Text style={styles.panelTitle}>Agenda da Família</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
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
      </ScrollView>

      <CloseFooterBar onPress={onClose} />
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
    backgroundColor: VIGILANCE_SCALES_UI.surface,
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
    backgroundColor: VIGILANCE_SCALES_UI.surface,
  },
  scrollContent: {
    paddingBottom: 12,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: VIGILANCE_SCALES_UI.surface,
  },
  homeBannerWrap: {
    width: '100%',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  geoHint: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    opacity: 0.88,
    marginBottom: 8,
  },
  geoHintError: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
});
