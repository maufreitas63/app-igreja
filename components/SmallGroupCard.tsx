import { SmallGroupGuideModal } from '@/components/SmallGroupGuideModal';
import { buildProfileMapNavigationAddressLine } from '@/lib/enrichProfileMapAddress';
import { formatShortName } from '@/lib/formatShortName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import {
  fetchCurrentSmallGroupGuide,
  fetchMySmallGroup,
  fetchNearbySmallGroupHosts,
  formatSmallGroupHostDistanceMeters,
  formatSmallGroupMemberCount,
  formatSmallGroupWeekday,
  joinSmallGroupAsMember,
  leaveSmallGroupAsMember,
  type MySmallGroup,
  type NearbySmallGroupHost,
  type SmallGroupGuide,
} from '@/lib/smallGroupsApi';
import { showAppToast } from '@/lib/appToast';
import { confirmDialog } from '@/lib/confirmDialog';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  panelHeight: number;
  isActive?: boolean;
};

export function SmallGroupCard({ panelHeight, isActive = true }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<MySmallGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<SmallGroupGuide | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [nearbyHosts, setNearbyHosts] = useState<NearbySmallGroupHost[]>([]);
  const [hasMemberLocation, setHasMemberLocation] = useState(true);
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Proteção aplicada: no Ghost o card segue o alvo, não o operador
    setLoading(true);
    setError(null);

    try {
      const [nextGroup, session] = await Promise.all([
        fetchMySmallGroup(),
        loadEffectiveSessionProfile(),
      ]);
      setGroup(nextGroup);
      setMemberName(session?.full_name?.trim() || 'membro');

      if (nextGroup) {
        setNearbyHosts([]);
        setHasMemberLocation(true);
      } else {
        const nearby = await fetchNearbySmallGroupHosts();
        setNearbyHosts(nearby.hosts);
        setHasMemberLocation(nearby.hasMemberLocation);
      }
    } catch (loadError) {
      setGroup(null);
      setNearbyHosts([]);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o grupo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void load();
  }, [isActive, load]);

  const hostAddress = useMemo(
    () => (group?.host ? buildProfileMapNavigationAddressLine(group.host) : null),
    [group?.host]
  );

  const canLeaveEnrolledGroup = Boolean(group && !group.is_host && !group.is_leader);

  const notify = useCallback((ok: boolean, message: string) => {
    showAppToast({
      type: ok ? 'success' : 'error',
      text1: 'Pequeno grupo',
      text2: message,
    });
  }, []);

  const handleOpenGuide = useCallback(async () => {
    try {
      const nextGuide = await fetchCurrentSmallGroupGuide();
      setGuide(nextGuide);
      setGuideOpen(true);
    } catch (guideError) {
      showAppToast({
        type: 'error',
        text1: 'Roteiro da Semana',
        text2: guideError instanceof Error ? guideError.message : 'Não foi possível abrir o roteiro.',
      });
    }
  }, []);

  const runLeaveGroup = useCallback(
    async (groupId: string) => {
      setBusyGroupId(groupId);

      try {
        const result = await leaveSmallGroupAsMember(groupId);
        notify(result.success, result.message);

        if (result.success) {
          await load();
        }
      } catch (leaveError) {
        notify(
          false,
          leaveError instanceof Error ? leaveError.message : 'Não foi possível sair do grupo.'
        );
      } finally {
        setBusyGroupId(null);
      }
    },
    [load, notify]
  );

  const handleJoinGroup = useCallback(
    async (host: NearbySmallGroupHost) => {
      const confirmed = await confirmDialog(
        'Participar do grupo',
        `Deseja se inscrever em "${host.groupName}"?`,
        'Confirmar',
        'Cancelar'
      );

      if (!confirmed) {
        return;
      }

      setBusyGroupId(host.groupId);

      try {
        const result = await joinSmallGroupAsMember(host.groupId);
        notify(result.success, result.message);

        if (result.success) {
          await load();
        }
      } catch (joinError) {
        notify(
          false,
          joinError instanceof Error ? joinError.message : 'Não foi possível participar.'
        );
      } finally {
        setBusyGroupId(null);
      }
    },
    [load, notify]
  );

  const handleLeaveGroup = useCallback(
    async (host: NearbySmallGroupHost) => {
      const confirmed = await confirmDialog(
        'Sair do grupo',
        `Deseja sair de "${host.groupName}"?`,
        'Sair',
        'Cancelar',
        { destructive: true }
      );

      if (confirmed) {
        await runLeaveGroup(host.groupId);
      }
    },
    [runLeaveGroup]
  );

  const handleLeaveEnrolledGroup = useCallback(async () => {
    if (!group) {
      return;
    }

    const confirmed = await confirmDialog(
      'Sair do grupo',
      `Deseja sair de "${group.name}"?`,
      'Sair',
      'Cancelar',
      { destructive: true }
    );

    if (confirmed) {
      await runLeaveGroup(group.id);
    }
  }, [group, runLeaveGroup]);

  const handleAbsence = useCallback(() => {
    if (!group?.leader?.phone) {
      notify(false, 'Não há telefone cadastrado para o líder deste grupo.');
      return;
    }

    const message = `Olá ${group.leader.full_name ?? 'líder'}, sou ${memberName} e não poderei participar do pequeno grupo ${group.name} nesta semana.`;
    openWhatsAppLikeBirthdaysWithText(group.leader.phone, message);
  }, [group, memberName, notify]);

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Pequeno Grupo</Text>
      <Text style={styles.subtitle}>Célula da sua jornada em comunidade.</Text>

      {loading ? (
        <ActivityIndicator color="#1E3A5F" style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : !group ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <View style={styles.stack}>
            <View style={styles.emptyCard}>
            <FontAwesome name="users" size={26} color="#93C5FD" />
            <Text style={styles.emptyTitle}>Você ainda não está em um grupo</Text>
            {nearbyHosts.length === 0 ? (
              <Text style={styles.emptyHint}>
                Não existe nenhum anfitrião disponível para alocação.
              </Text>
            ) : (
              <>
                <Text style={styles.emptyHint}>
                  Anfitriões mais próximos da sua residência, da menor para a maior distância.
                </Text>
                {hasMemberLocation ? null : (
                  <Text style={styles.emptyHint}>
                    Cadastre o CEP no seu perfil para calcular a distância até cada anfitrião.
                  </Text>
                )}
              </>
            )}
          </View>
          {nearbyHosts.map((host) => (
            <View key={host.groupId} style={styles.hostCard}>
              <Text style={styles.hostName} numberOfLines={1}>
                {formatShortName(host.hostName)}
              </Text>
              <Text style={styles.hostMeta} numberOfLines={2}>
                {host.groupName}
              </Text>
              <Text style={styles.hostMeta}>Bairro: {host.neighborhood}</Text>
              <Text style={styles.hostMeta}>
                Reuniões: {formatSmallGroupWeekday(host.meetingWeekday)}
                {host.meetingTime ? ` · ${host.meetingTime}` : ''}
              </Text>
              <Text style={styles.hostMeta}>{formatSmallGroupMemberCount(host.memberCount)}</Text>
              <Text style={styles.hostDistance}>
                {formatSmallGroupHostDistanceMeters(host.distanceMeters)}
              </Text>
              <TouchableOpacity
                style={[
                  host.isMember ? styles.leaveButton : styles.joinButton,
                  styles.hostCardAction,
                  busyGroupId !== null && styles.buttonDisabled,
                ]}
                onPress={() =>
                  void (host.isMember ? handleLeaveGroup(host) : handleJoinGroup(host))
                }
                disabled={busyGroupId !== null}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  host.isMember
                    ? `Quero sair do grupo ${host.groupName}`
                    : `Quero participar do grupo ${host.groupName}`
                }
              >
                {busyGroupId === host.groupId ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>
                    {host.isMember ? 'Quero sair do Grupo' : 'Quero Participar do Grupo'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <View style={styles.stack}>
          <View style={styles.bodyCard}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.meta}>
              {formatSmallGroupWeekday(group.meeting_weekday)} · {group.meeting_time || '—'}
            </Text>
            <Text style={styles.meta}>Líder: {group.leader?.full_name ?? '—'}</Text>
            <Text style={styles.meta}>Anfitrião: {group.host?.full_name ?? '—'}</Text>
            <Text style={styles.address} numberOfLines={3}>
              {hostAddress ?? 'Endereço do anfitrião ainda não cadastrado.'}
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleOpenGuide()} activeOpacity={0.85}>
            <FontAwesome name="book" size={14} color="#FFFFFF" />
            <Text style={styles.buttonText}>Roteiro da Semana</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.absenceButton, !group.leader?.phone && styles.buttonDisabled]}
            onPress={handleAbsence}
            disabled={!group.leader?.phone}
            activeOpacity={0.85}
          >
            <FontAwesome name="whatsapp" size={16} color="#FFFFFF" />
            <Text style={styles.buttonText}>Avisar Ausência</Text>
          </TouchableOpacity>

          {canLeaveEnrolledGroup ? (
            <TouchableOpacity
              style={[styles.leaveButton, busyGroupId !== null && styles.buttonDisabled]}
              onPress={() => void handleLeaveEnrolledGroup()}
              disabled={busyGroupId !== null}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Quero sair do grupo ${group.name}`}
            >
              {busyGroupId === group.id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Quero sair do Grupo</Text>
              )}
            </TouchableOpacity>
          ) : null}
          </View>
        </ScrollView>
      )}

      <SmallGroupGuideModal visible={guideOpen} guide={guide} onClose={() => setGuideOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    fontSize: 13,
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  hostCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 2,
  },
  hostName: {
    color: '#1E3A5F',
    fontSize: 14,
    fontWeight: '800',
  },
  hostMeta: {
    color: '#475569',
    fontSize: 12,
  },
  hostDistance: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  joinButton: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  hostCardAction: {
    marginTop: 8,
  },
  leaveButton: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    paddingBottom: 12,
  },
  stack: {
    width: '100%',
    gap: 8,
  },
  bodyCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  groupName: {
    color: '#1E3A5F',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  meta: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
  },
  address: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  absenceButton: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
});
