import { useRegisteredEventMembers, type RegistrationStatus } from '@/hooks/useRegisteredEventMembers';
import { useRegisterMember } from '@/hooks/useRegisterMember';
import { useUnregisterMember } from '@/hooks/useUnregisterMember';
import { useFamilyAudienceMembers } from '@/hooks/useFamilyAudienceMembers';
import {
  fetchProfileEventRegistrationStatus,
  registerProfileForEvent,
  unregisterProfileFromEvent,
} from '@/lib/profileEventRegistration';
import { resolveActiveSessionMember } from '@/lib/resolveActiveSessionMember';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MemberCheckboxItem } from './MemberCheckboxItem';

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
  title?: string;
  onRegistrationChange?: () => Promise<void> | void;
  showKidsIndicator?: boolean;
  showTeensIndicator?: boolean;
  /** Audiência individual: só o membro do usuário ativo na lista. */
  quorumMode?: boolean;
  /** Quórum: check-in confirmado no totem — cadeado fechado e sem desmarcar audiência. */
  quorumTotemCheckinConfirmed?: boolean;
  sessionPhone?: string | null;
  sessionProfileName?: string | null;
  /** Perfil da sessão — habilita inscrição individual quando não há família/membros. */
  sessionProfile?: SessionProfileRegistration | null;
};

export const FamilyRegistrationList = ({
  familyId,
  eventId,
  title,
  onRegistrationChange,
  showKidsIndicator = false,
  showTeensIndicator = false,
  quorumMode = false,
  quorumTotemCheckinConfirmed = false,
  sessionPhone = null,
  sessionProfileName = null,
  sessionProfile = null,
}: Props) => {
  const hasFamilyId = Boolean(familyId?.trim());
  const { members, loading, error } = useFamilyAudienceMembers(
    hasFamilyId ? familyId : '',
    sessionProfile,
    sessionProfileName
  );
  const { registerMember, loading: registering } = useRegisterMember();
  const { unregisterMember, loading: unregistering } = useUnregisterMember();
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

  const visibleMembers = useMemo(() => {
    if (!quorumMode) {
      return members;
    }

    if (!activeSessionMember) {
      return [];
    }

    return [activeSessionMember];
  }, [activeSessionMember, members, quorumMode]);

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
      sessionProfile.full_name?.trim()
      || sessionProfileName?.trim()
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
    registering ||
    unregistering ||
    loadingRegisteredMembers ||
    soloStatusLoading ||
    soloToggleLoading;

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

    try {
      if (registeredMemberIds.includes(memberId)) {
        if (quorumMode && quorumTotemCheckinConfirmed) {
          return;
        }

        setPendingUnregisterIds([memberId]);
        await unregisterMember({
          eventId,
          memberId: member.id,
          familyId: member.family_id,
        });
      } else {
        setPendingRegisterIds([memberId]);
        await registerMember({
          eventId,
          memberId: member.id,
          familyId: member.family_id,
        });
      }

      await refetchRegisteredMembers();
      await onRegistrationChange?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : registeredMemberIds.includes(memberId)
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

    try {
      if (allRegistered) {
        setPendingUnregisterIds(targetMembers.map((member) => member.id));
        for (const member of targetMembers) {
          await unregisterMember({
            eventId,
            memberId: member.id,
            familyId: member.family_id,
          });
        }
      } else {
        setPendingRegisterIds(targetMembers.map((member) => member.id));
        for (const member of targetMembers) {
          await registerMember({
            eventId,
            memberId: member.id,
            familyId: member.family_id,
          });
        }
      }

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
            registrationStatus={soloRegistrationStatus}
            showKidsIndicator={showKidsIndicator}
            showTeensIndicator={showTeensIndicator}
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

  return (
    <View style={styles.wrapper}>
      {registeredMembersError ? (
        <Text style={styles.helperErrorText}>Nao foi possivel verificar as inscricoes ja existentes.</Text>
      ) : null}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{title ?? 'Audiência da Família'}</Text>
        {hasEventOpen && !quorumMode ? (
          <TouchableOpacity
            style={[
              styles.bulkCheckbox,
              allRegistered && styles.bulkCheckboxChecked,
              (isBusy || allPending) && styles.bulkCheckboxDisabled,
            ]}
            onPress={() => {
              void toggleAllMembers();
            }}
            disabled={isBusy || allPending}
            activeOpacity={0.8}
          >
            {isBusy || allPending ? (
              <ActivityIndicator size="small" color="#020617" />
            ) : allRegistered ? (
              <Text style={styles.bulkCheckboxMark}>✓</Text>
            ) : null}
          </TouchableOpacity>
        ) : null}
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
      <View style={styles.listFrame}>
        <View style={styles.listContainer}>
        <FlatList
          data={visibleMembers}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const isItemRegistered =
              registeredMemberIds.includes(item.id) && !pendingUnregisterIds.includes(item.id);
            const quorumUnregisterLocked =
              quorumMode && quorumTotemCheckinConfirmed && isItemRegistered;

            return (
              <MemberCheckboxItem
                member={item}
                disabled={!hasEventOpen || isBusy || quorumUnregisterLocked}
                isChecked={
                  pendingRegisterIds.includes(item.id) ||
                  (registeredMemberIds.includes(item.id) && !pendingUnregisterIds.includes(item.id))
                }
                isLoading={
                  pendingRegisterIds.includes(item.id) || pendingUnregisterIds.includes(item.id)
                }
                isRegistered={isItemRegistered}
                registrationStatus={registeredMemberStatusById[item.id]}
                showKidsIndicator={showKidsIndicator}
                showTeensIndicator={showTeensIndicator}
                onToggle={() => {
                  if (!hasEventOpen || isBusy || quorumUnregisterLocked) {
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
  },
  listFrame: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    paddingHorizontal: 4,
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
    flex: 1,
  },
  listContainer: {
    flex: 1,
    minHeight: 0,
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
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  bulkCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bulkCheckboxChecked: {
    backgroundColor: '#10b981',
  },
  bulkCheckboxDisabled: {
    opacity: 0.5,
  },
  bulkCheckboxMark: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '900',
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
