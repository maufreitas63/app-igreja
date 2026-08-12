import { useRegisteredEventMembers, type RegistrationStatus } from '@/hooks/useRegisteredEventMembers';
import { useSyncFamilyEventRegistrations } from '@/hooks/useSyncFamilyEventRegistrations';
import { useFamilyAudienceMembers } from '@/hooks/useFamilyAudienceMembers';
import {
  fetchProfileEventRegistrationStatus,
  registerProfileForEvent,
  unregisterProfileFromEvent,
} from '@/lib/profileEventRegistration';
import { resolveActiveSessionMember } from '@/lib/resolveActiveSessionMember';
import { formatFullName } from '@/lib/fullName';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { GeoCoordinates } from '@/lib/checkinGeofence';
import {
  enqueueGeoCheckinOperation,
  isDeviceOnline,
} from '@/lib/checkinOfflineQueue';
import type { GeoCheckinUiStatus } from '@/hooks/useGeoCheckinMonitor';
import { GeoCheckinStatusBanner } from '@/components/GeoCheckinStatusBanner';
import { MinimalRoomSelosRow } from '@/components/minimal/MinimalRoomSelosRow';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MemberCheckboxItem } from './MemberCheckboxItem';
import {
  buildAudienceRoomLabelIndex,
  lookupAudienceRoomLabel,
  resolveAudienceRoomLabels,
} from '@/lib/userRoomAssignment';

export type SessionProfileRegistration = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  family_id?: string | null;
};

type Props = {
  familyId: string;
  eventId?: string;
  /** Nome do evento (exibido em «Inscrito em: …»). */
  eventName?: string | null;
  title?: string;
  onRegistrationChange?: () => Promise<void> | void;
  showKidsIndicator?: boolean;
  showTeensIndicator?: boolean;
  /** Audiência familiar com regras de quórum (cadeado/totem); a lista mostra toda a família. */
  quorumMode?: boolean;
  /** Quórum: check-in confirmado no totem — cadeado fechado e sem desmarcar audiência. */
  quorumTotemCheckinConfirmed?: boolean;
  sessionPhone?: string | null;
  sessionProfileName?: string | null;
  /** Perfil da sessão — habilita inscrição individual quando não há família/membros. */
  sessionProfile?: SessionProfileRegistration | null;
  /** Coordenadas atuais do dispositivo (geofence). */
  deviceCoordinates?: GeoCoordinates | null;
  /** Tolerância de geofence ao editar audiência com check-in já válido. */
  skipGeofenceOnSave?: boolean;
  /** Estado visual do check-in automático por proximidade. */
  geoCheckinStatus?: GeoCheckinUiStatus;
  /** Progresso das leituras GPS consecutivas dentro do raio. */
  geoCheckinGpsProgress?: { current: number; required: number };
  /** Distância atual até o local do evento (metros). */
  geoCheckinDistanceMeters?: number | null;
  /** Raio configurado do geofence (metros). */
  geoCheckinRadiusMeters?: number;
  /** Estilo minimalista (texto azul, sem moldura de card). */
  minimal?: boolean;
  /** Selos IBN Kids/Teens já exibidos no cabeçalho expandido. */
  hideRoomSelos?: boolean;
  /** Salas habilitadas no evento; só mostra o rótulo se a sala do membro estiver nesta lista. */
  eventEnabledRoomKeys?: string[] | null;
};

/** Métricas alinhadas a MemberCheckboxItem + contentContainerStyle da lista. */
const LIST_CONTENT_PADDING_TOP = 8;
const MEMBER_ROW_PADDING_VERTICAL = 8;
const MEMBER_CHECKBOX_HEIGHT = 24;
const MEMBER_NAME_LINE_HEIGHT = 22;
const MEMBER_REGISTERED_LINE_HEIGHT = 16;

function getMemberRowHeight(_isRegistered: boolean): number {
  const infoHeight = MEMBER_NAME_LINE_HEIGHT + MEMBER_REGISTERED_LINE_HEIGHT;
  return MEMBER_ROW_PADDING_VERTICAL * 2 + Math.max(MEMBER_CHECKBOX_HEIGHT, infoHeight);
}

export const FamilyRegistrationList = ({
  familyId,
  eventId,
  eventName = null,
  title,
  onRegistrationChange,
  showKidsIndicator = false,
  showTeensIndicator = false,
  quorumMode = false,
  quorumTotemCheckinConfirmed = false,
  sessionPhone = null,
  sessionProfileName = null,
  sessionProfile = null,
  deviceCoordinates = null,
  skipGeofenceOnSave = false,
  geoCheckinStatus = 'idle',
  geoCheckinGpsProgress = { current: 0, required: 3 },
  geoCheckinDistanceMeters = null,
  geoCheckinRadiusMeters = 30,
  minimal = false,
  hideRoomSelos = false,
  eventEnabledRoomKeys = null,
}: Props) => {
  const resolvedEventName = useMemo(() => {
    const explicit = eventName?.trim();
    if (explicit) {
      return explicit;
    }
    const fromTitle = title?.trim() ?? '';
    const audiênciaPrefix = /^audiência\s+para\s+/i;
    if (audiênciaPrefix.test(fromTitle)) {
      return fromTitle.replace(audiênciaPrefix, '').trim();
    }
    return fromTitle || null;
  }, [eventName, title]);
  const hasFamilyId = Boolean(familyId?.trim());
  const { members, loading, error } = useFamilyAudienceMembers(
    hasFamilyId ? familyId : '',
    sessionProfile,
    sessionProfileName
  );
  const { syncFamilyRegistrations, confirmGeoCheckin, loading: syncingRegistrations } =
    useSyncFamilyEventRegistrations();
  const {
    registeredMemberIds,
    registeredMemberStatusById,
    loading: loadingRegisteredMembers,
    error: registeredMembersError,
    refetch: refetchRegisteredMembers,
  } = useRegisteredEventMembers(eventId, members, familyId);
  const [pendingRegisterIds, setPendingRegisterIds] = useState<string[]>([]);
  const [pendingUnregisterIds, setPendingUnregisterIds] = useState<string[]>([]);
  const [soloRegistered, setSoloRegistered] = useState(false);
  const [soloRegistrationStatus, setSoloRegistrationStatus] = useState<
    RegistrationStatus | undefined
  >(undefined);
  const [roomLabelByMemberId, setRoomLabelByMemberId] = useState<Record<string, string>>({});
  const [roomOverlayByMemberId, setRoomOverlayByMemberId] = useState<Record<string, boolean>>(
    {}
  );

  const allowedRoomKeys = useMemo(() => {
    const keys = Array.isArray(eventEnabledRoomKeys)
      ? eventEnabledRoomKeys
          .map((key) => String(key ?? '').trim().toUpperCase())
          .filter((key) => /^[A-Z0-9_]{2,40}$/.test(key))
      : [];
    if (keys.length > 0) {
      return new Set(keys);
    }
    const fallback = new Set<string>();
    if (showKidsIndicator) fallback.add('KIDS');
    if (showTeensIndicator) fallback.add('TEENS');
    return fallback;
  }, [eventEnabledRoomKeys, showKidsIndicator, showTeensIndicator]);
  const [soloStatusLoading, setSoloStatusLoading] = useState(false);
  const [soloToggleLoading, setSoloToggleLoading] = useState(false);

  useEffect(() => {
    setPendingRegisterIds([]);
    setPendingUnregisterIds([]);
  }, [familyId, eventId, sessionProfile?.id]);

  const hasEventOpen = Boolean(eventId);

  const activeSessionMember = useMemo(
    () =>
      resolveActiveSessionMember(members, {
        sessionPhone,
        sessionProfileName,
      }),
    [members, sessionPhone, sessionProfileName]
  );

  const visibleMembers = useMemo(() => members, [members]);

  const soloMode = useMemo(() => {
    if (!sessionProfile?.id || quorumMode) {
      return false;
    }

    if (!hasFamilyId) {
      return true;
    }

    if (!loading && !error && members.length === 0) {
      return true;
    }

    return false;
  }, [error, hasFamilyId, loading, members.length, quorumMode, sessionProfile?.id]);

  const soloParticipant = useMemo(() => {
    if (!sessionProfile?.id) {
      return null;
    }

    const displayName =
      formatFullName(sessionProfile.full_name ?? sessionProfileName)
      || 'Participante';

    return {
      id: sessionProfile.id,
      full_name: displayName,
      phone: sessionProfile.phone ?? sessionPhone ?? null,
      birth_date: sessionProfile.birth_date ?? null,
      relationship: null,
      family_id: sessionProfile.family_id?.trim() || familyId || '',
    };
  }, [familyId, sessionPhone, sessionProfile, sessionProfileName]);

  useEffect(() => {
    let active = true;
    const audience = soloMode && soloParticipant ? [soloParticipant] : visibleMembers;

    if (!audience.length) {
      setRoomLabelByMemberId({});
      setRoomOverlayByMemberId({});
      return undefined;
    }

    void resolveAudienceRoomLabels(
      audience.map((member) => member.phone),
      { familyId: familyId || null }
    ).then((rows) => {
      if (!active) return;
      const index = buildAudienceRoomLabelIndex(rows);
      const next: Record<string, string> = {};
      const nextOverlay: Record<string, boolean> = {};
      for (const member of audience) {
        const match = lookupAudienceRoomLabel(index, member);
        if (!match) continue;
        // Exibe a sala efetiva (padrão ou especial), independente das salas habilitadas no evento.
        next[member.id] = match.room_label;
        nextOverlay[member.id] = match.room_kind === 'especial';
      }
      setRoomLabelByMemberId(next);
      setRoomOverlayByMemberId(nextOverlay);
    });

    return () => {
      active = false;
    };
  }, [familyId, soloMode, soloParticipant, visibleMembers]);

  const refetchSoloRegistrationStatus = useCallback(async () => {
    if (!soloMode || !eventId || !sessionProfile?.id) {
      setSoloRegistered(false);
      setSoloRegistrationStatus(undefined);
      setSoloStatusLoading(false);
      return;
    }

    setSoloStatusLoading(true);

    try {
      const status = await fetchProfileEventRegistrationStatus(
        eventId,
        sessionProfile.id,
        sessionProfile.birth_date
      );
      setSoloRegistered(status.isRegistered);
      setSoloRegistrationStatus(status.registrationStatus);
    } catch (err) {
      console.error('Erro ao carregar inscrição individual:', err);
      setSoloRegistered(false);
      setSoloRegistrationStatus(undefined);
    } finally {
      setSoloStatusLoading(false);
    }
  }, [eventId, sessionProfile?.birth_date, sessionProfile?.id, soloMode]);

  useEffect(() => {
    void refetchSoloRegistrationStatus();
  }, [refetchSoloRegistrationStatus]);

  const toggleSoloRegistration = async () => {
    if (!eventId || !sessionProfile?.id || soloToggleLoading) {
      return;
    }

    setSoloToggleLoading(true);

    try {
      if (soloRegistered) {
        await unregisterProfileFromEvent(eventId, sessionProfile.id);
      } else {
        await registerProfileForEvent(eventId, sessionProfile.id);
      }

      await refetchSoloRegistrationStatus();
      await onRegistrationChange?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : soloRegistered
            ? 'Não foi possível remover sua inscrição do evento.'
            : 'Não foi possível registrar sua inscrição no evento.';
      Alert.alert('Erro', message);
    } finally {
      setSoloToggleLoading(false);
    }
  };

  const isBusy =
    syncingRegistrations ||
    loadingRegisteredMembers ||
    soloStatusLoading ||
    soloToggleLoading;

  const resolveTargetMemberIds = useCallback(
    (toggleMemberId?: string) => {
      const ids = new Set<string>();

      for (const member of visibleMembers) {
        const isRegistered =
          registeredMemberIds.includes(member.id) && !pendingUnregisterIds.includes(member.id);
        const isPendingRegister = pendingRegisterIds.includes(member.id);

        if (isRegistered || isPendingRegister) {
          ids.add(member.id);
        }
      }

      if (toggleMemberId) {
        if (ids.has(toggleMemberId)) {
          ids.delete(toggleMemberId);
        } else {
          ids.add(toggleMemberId);
        }
      }

      return Array.from(ids);
    },
    [pendingRegisterIds, pendingUnregisterIds, registeredMemberIds, visibleMembers]
  );

  const persistFamilyRegistrations = useCallback(
    async (memberIds: string[]) => {
      if (!eventId || !hasFamilyId) {
        return;
      }

      const payload = {
        eventId,
        familyId,
        memberIds,
        coordinates: deviceCoordinates,
        skipGeofence: true,
      };

      if (!isDeviceOnline()) {
        await enqueueGeoCheckinOperation({
          type: 'sync_registrations',
          eventId,
          familyId,
          memberIds,
          latitude: deviceCoordinates?.latitude ?? 0,
          longitude: deviceCoordinates?.longitude ?? 0,
          skipGeofence: true,
        });
        return;
      }

      await syncFamilyRegistrations(payload);

      if (skipGeofenceOnSave && memberIds.length > 0) {
        await confirmGeoCheckin({
          eventId,
          familyId,
          coordinates: deviceCoordinates,
          skipGeofence: true,
        });
      }
    },
    [
      confirmGeoCheckin,
      deviceCoordinates,
      eventId,
      familyId,
      hasFamilyId,
      skipGeofenceOnSave,
      syncFamilyRegistrations,
    ]
  );

  const allRegistered = members.length > 0 && members.every((member) => registeredMemberIds.includes(member.id));
  const allPending = pendingRegisterIds.length === members.length || pendingUnregisterIds.length === members.length;

  const toggleMember = async (memberId: string) => {
    if (!eventId) {
      return;
    }

    const member = members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }

    // Quórum: só o integrante da sessão pode marcar/desmarcar a própria presença.
    if (
      quorumMode
      && activeSessionMember
      && memberId !== activeSessionMember.id
    ) {
      return;
    }

    const isCurrentlyRegistered =
      registeredMemberIds.includes(memberId) && !pendingUnregisterIds.includes(memberId);
    const nextMemberIds = resolveTargetMemberIds(memberId);

    try {
      if (isCurrentlyRegistered) {
        if (quorumMode && quorumTotemCheckinConfirmed) {
          return;
        }

        setPendingUnregisterIds([memberId]);
      } else {
        setPendingRegisterIds([memberId]);
      }

      await persistFamilyRegistrations(nextMemberIds);
      await refetchRegisteredMembers();
      await onRegistrationChange?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isCurrentlyRegistered
            ? 'Nao foi possivel remover o participante do evento.'
            : 'Nao foi possivel registrar o participante no evento.';
      Alert.alert('Erro', message);
    } finally {
      setPendingRegisterIds([]);
      setPendingUnregisterIds([]);
    }
  };

  const toggleAllMembers = async () => {
    if (!eventId || !visibleMembers.length || isBusy || quorumMode) {
      return;
    }

    const targetMembers = allRegistered
      ? visibleMembers.filter((member) => registeredMemberIds.includes(member.id))
      : visibleMembers.filter((member) => !registeredMemberIds.includes(member.id));

    if (!targetMembers.length) {
      return;
    }

    const nextMemberIds = allRegistered
      ? resolveTargetMemberIds().filter((id) => !targetMembers.some((member) => member.id === id))
      : Array.from(
          new Set([...resolveTargetMemberIds(), ...targetMembers.map((member) => member.id)])
        );

    try {
      if (allRegistered) {
        setPendingUnregisterIds(targetMembers.map((member) => member.id));
      } else {
        setPendingRegisterIds(targetMembers.map((member) => member.id));
      }

      await persistFamilyRegistrations(nextMemberIds);
      await refetchRegisteredMembers();
      await onRegistrationChange?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : allRegistered
            ? 'Nao foi possivel remover todos os participantes do evento.'
            : 'Nao foi possivel registrar todos os participantes do evento.';
      Alert.alert('Erro', message);
    } finally {
      setPendingRegisterIds([]);
      setPendingUnregisterIds([]);
    }
  };

  if (!hasFamilyId && !sessionProfile?.id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Faça login para se inscrever em eventos.</Text>
      </View>
    );
  }

  if (quorumMode && sessionProfile?.id && !hasFamilyId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          Somente membros cadastrados na família podem se inscrever em eventos com quórum.
        </Text>
      </View>
    );
  }

  if (soloMode && soloParticipant) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>
            {title ?? 'Inscrição individual'}
          </Text>
        </View>
        {!hasFamilyId ? (
          <Text style={styles.soloHint}>
            Você ainda não está vinculado a uma família. Marque abaixo para se inscrever
            individualmente neste evento.
          </Text>
        ) : null}
        <View style={styles.listFrame}>
          <MemberCheckboxItem
            member={soloParticipant}
            disabled={!hasEventOpen || isBusy}
            isChecked={soloRegistered}
            isLoading={soloToggleLoading || soloStatusLoading}
            isRegistered={soloRegistered}
            registeredEventName={resolvedEventName}
            registrationStatus={soloRegistrationStatus}
            showKidsIndicator={showKidsIndicator}
            showTeensIndicator={showTeensIndicator}
            assignedRoomLabel={roomLabelByMemberId[soloParticipant.id]}
            assignedRoomIsOverlay={roomOverlayByMemberId[soloParticipant.id] === true}
            onToggle={() => {
              if (!hasEventOpen || isBusy) {
                return;
              }
              void toggleSoloRegistration();
            }}
          />
        </View>
      </View>
    );
  }

  if (hasFamilyId && loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (hasFamilyId && error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erro ao carregar família.</Text>
      </View>
    );
  }

  if (quorumMode && sessionProfile?.id && !activeSessionMember) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {members.length === 0
            ? 'Somente membros cadastrados na família podem se inscrever em eventos com quórum.'
            : 'Não foi possível identificar seu cadastro na família para este evento com quórum. Verifique se o telefone da sessão coincide com o membro cadastrado.'}
        </Text>
      </View>
    );
  }

  if (!visibleMembers.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Nenhum membro encontrado.</Text>
      </View>
    );
  }

  const bulkTopOffset = LIST_CONTENT_PADDING_TOP + MEMBER_ROW_PADDING_VERTICAL;
  const totalMemberRowsHeight = visibleMembers.reduce((sum, member) => {
    const isRegistered =
      registeredMemberIds.includes(member.id) && !pendingUnregisterIds.includes(member.id);
    return sum + getMemberRowHeight(isRegistered);
  }, 0);
  const bulkSelectionHeight = Math.max(
    MEMBER_CHECKBOX_HEIGHT,
    totalMemberRowsHeight - MEMBER_ROW_PADDING_VERTICAL * 2
  );
  const showBulkCheckbox = hasEventOpen && !quorumMode;

  return (
    <View style={styles.wrapper}>
      <GeoCheckinStatusBanner
        status={geoCheckinStatus}
        gpsProgress={geoCheckinGpsProgress}
        distanceMeters={geoCheckinDistanceMeters}
        radiusMeters={geoCheckinRadiusMeters}
      />
      {registeredMembersError ? (
        <Text style={styles.helperErrorText}>Nao foi possivel verificar as inscricoes ja existentes.</Text>
      ) : null}
      <View style={[styles.headerRow, minimal && styles.headerRowMinimal]}>
        {minimal && !hideRoomSelos && (showKidsIndicator || showTeensIndicator) ? (
          <View style={styles.headerSelosWrap}>
            <MinimalRoomSelosRow
              showKids={showKidsIndicator}
              showTeens={showTeensIndicator}
            />
          </View>
        ) : (
          <Text style={[styles.headerTitle, minimal && styles.headerTitleMinimal]} numberOfLines={2}>
            {title ?? 'Audiência da Família'}
          </Text>
        )}
        {hasEventOpen && quorumMode ? (
          <FontAwesome
            name={quorumTotemCheckinConfirmed ? 'lock' : 'unlock-alt'}
            size={14}
            color={quorumTotemCheckinConfirmed ? '#94A3B8' : '#FBBF24'}
            accessibilityLabel={
              quorumTotemCheckinConfirmed
                ? 'Check-in no totem concluído — não é possível desmarcar a audiência'
                : 'Check-in no totem pendente'
            }
          />
        ) : null}
      </View>
      <View style={[styles.listFrame, minimal && styles.listFrameMinimal]}>
        <View style={styles.listWithBulkRow}>
          {showBulkCheckbox ? (
            <TouchableOpacity
              accessibilityLabel={
                allRegistered ? 'Desmarcar toda a família' : 'Marcar toda a família'
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allRegistered, disabled: isBusy || allPending }}
              style={[
                styles.bulkCheckboxColumn,
                { paddingTop: bulkTopOffset },
                (isBusy || allPending) && styles.bulkCheckboxColumnDisabled,
              ]}
              onPress={() => {
                void toggleAllMembers();
              }}
              disabled={isBusy || allPending}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.bulkCheckbox,
                  minimal && styles.bulkCheckboxMinimal,
                  { height: bulkSelectionHeight },
                  allRegistered && styles.bulkCheckboxChecked,
                  allRegistered && minimal && styles.bulkCheckboxCheckedMinimal,
                  (isBusy || allPending) && styles.bulkCheckboxDisabled,
                ]}
              >
                {isBusy || allPending ? (
                  <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.icon : '#020617'} />
                ) : allRegistered ? (
                  <Text style={[styles.bulkCheckboxMark, minimal && styles.bulkCheckboxMarkMinimal]}>
                    ✓
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ) : null}
          <View style={styles.listContainer}>
        <FlatList
          data={visibleMembers}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const isItemRegistered =
              registeredMemberIds.includes(item.id) && !pendingUnregisterIds.includes(item.id);
            const quorumUnregisterLocked =
              quorumMode && quorumTotemCheckinConfirmed && isItemRegistered;
            const quorumOtherMemberLocked =
              quorumMode
              && Boolean(activeSessionMember)
              && item.id !== activeSessionMember?.id;
            const rowDisabled =
              !hasEventOpen || isBusy || quorumUnregisterLocked || quorumOtherMemberLocked;

            return (
              <MemberCheckboxItem
                member={item}
                minimal={minimal}
                disabled={rowDisabled}
                isChecked={
                  pendingRegisterIds.includes(item.id) ||
                  (registeredMemberIds.includes(item.id) && !pendingUnregisterIds.includes(item.id))
                }
                isLoading={
                  pendingRegisterIds.includes(item.id) || pendingUnregisterIds.includes(item.id)
                }
                isRegistered={isItemRegistered}
                registeredEventName={resolvedEventName}
                registrationStatus={registeredMemberStatusById[item.id]}
                showKidsIndicator={showKidsIndicator}
                showTeensIndicator={showTeensIndicator}
                assignedRoomLabel={roomLabelByMemberId[item.id]}
                assignedRoomIsOverlay={roomOverlayByMemberId[item.id] === true}
                onToggle={() => {
                  if (rowDisabled) {
                    return;
                  }
                  void toggleMember(item.id);
                }}
              />
            );
          }}
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          bounces
          alwaysBounceVertical
        />
          </View>
        </View>
      </View>
      {hasEventOpen && loadingRegisteredMembers ? (
        <Text style={styles.helperText}>Carregando participantes já registrados...</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  listFrame: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    paddingHorizontal: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  listFrameMinimal: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  headerRowMinimal: {
    marginBottom: 4,
    flexWrap: 'wrap',
    width: '100%',
    alignItems: 'flex-start',
  },
  headerSelosWrap: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: '70%',
  },
  headerTitleMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 12,
  },
  listContainer: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
  },
  listWithBulkRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  bulkCheckboxColumn: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  bulkCheckboxColumnDisabled: {
    opacity: 0.5,
  },
  listScroll: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  list: {
    paddingVertical: 8,
    paddingBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  helperText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  bulkCheckbox: {
    width: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bulkCheckboxMinimal: {
    borderColor: MINIMAL_UI.icon,
  },
  bulkCheckboxChecked: {
    backgroundColor: '#10b981',
  },
  bulkCheckboxCheckedMinimal: {
    backgroundColor: MINIMAL_UI.icon,
  },
  bulkCheckboxDisabled: {
    opacity: 0.5,
  },
  bulkCheckboxMark: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '900',
  },
  bulkCheckboxMarkMinimal: {
    color: MINIMAL_UI.background,
  },
  helperErrorText: {
    color: '#F59E0B',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  soloHint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
});
