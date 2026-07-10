import { FamilyAgendaView } from '@/components/FamilyAgendaView';
import { FamilyRegistrationList } from '@/components/FamilyRegistrationList';
import { useActiveEvents, type ActiveEventListItem } from '@/hooks/useActiveEvents';
import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import { resolveFamilyIdForPhone, normalizeFamilyCode } from '@/lib/family';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getStoredUserPhone } from '@/lib/userSession';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  initialEventId: string | null;
  onClose: () => void;
};

/** Painel inline da Agenda da Família — entre o topo (saudação) e a barra «Encerrar sessão». */
export function FamilyAgendaModal({ visible, initialEventId, onClose }: Props) {
  const { events, loading, error, refetch } = useActiveEvents({
    enabled: visible,
    enablePolling: visible,
  });
  const {
    kidsRoomBadgeLabel,
    teensRoomBadgeLabel,
  } = useRoomDisplayLabels();

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
    if (!visible) {
      return;
    }

    let isMounted = true;

    const loadSession = async () => {
      setIsProfileLoading(true);

      try {
        const phone = await getStoredUserPhone();
        const sessionProfile = await loadEffectiveSessionProfile();

        if (!isMounted) {
          return;
        }

        setUserPhone(phone);
        setProfile(sessionProfile?.id ? sessionProfile : null);

        const resolvedFamilyId = sessionProfile?.family_id
          ? normalizeFamilyCode(sessionProfile.family_id)
          : phone
            ? await resolveFamilyIdForPhone(phone)
            : null;

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
  }, [visible]);

  const selectedEvent: ActiveEventListItem | null = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  );

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

  const registrationSection =
    familyRegistrationSessionProfile && selectedEvent ? (
      <FamilyRegistrationList
        familyId={familyId ?? ''}
        eventId={selectedEvent.id}
        title={`Audiência para ${selectedEvent.name}`}
        onRegistrationChange={handleRegistrationChange}
        showKidsIndicator={Boolean(selectedEvent.kids_room)}
        showTeensIndicator={Boolean(selectedEvent.teens_room)}
        quorumMode={selectedEvent.requer_quorum === true}
        sessionPhone={userPhone}
        sessionProfileName={profile?.full_name ?? null}
        sessionProfile={familyRegistrationSessionProfile}
        minimal
        hideRoomSelos
      />
    ) : null;

  if (!visible) {
    return null;
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
          kidsRoomBadgeLabel={kidsRoomBadgeLabel}
          teensRoomBadgeLabel={teensRoomBadgeLabel}
          capacityFillColor={capacityFillColor}
          capacityRatio={capacityRatio}
          registrationSection={registrationSection}
          loginRequiredMessage={
            !familyRegistrationSessionProfile && !loading && !isProfileLoading
              ? 'Faça login para se inscrever em eventos.'
              : null
          }
        />
      </ScrollView>

      <View style={styles.footerBar}>
        <Pressable
          onPress={onClose}
          style={styles.closeFooterButton}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Text style={styles.closeFooterButtonText}>Fechar</Text>
        </Pressable>
      </View>
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
    shadowOpacity: 0,
    elevation: 0,
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
  footerBar: {
    flexShrink: 0,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: VIGILANCE_SCALES_UI.surface,
    width: '100%',
  },
  closeFooterButton: {
    minHeight: 51,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1B4F8A',
    backgroundColor: '#3A96DD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
