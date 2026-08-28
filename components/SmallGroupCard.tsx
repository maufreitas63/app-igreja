import { SmallGroupGuideModal } from '@/components/SmallGroupGuideModal';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { buildProfileMapNavigationAddressLine } from '@/lib/enrichProfileMapAddress';
import { formatShortName } from '@/lib/formatShortName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Mesmo recorte da Carteirinha Digital (`PerfilClass.actionRow`). */
const PERFIL_ACTION_ICON_COLOR = '#1B4F8A';
const PERFIL_ACTION_SURFACE = '#FFFFFF';
const PERFIL_ACTION_BORDER = 'rgba(52, 211, 153, 0.35)';

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
      <Text style={styles.title}>Pequeno Grupo</Text>
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
            <View style={[styles.infoRow, styles.emptyInfoRow]}>
            <FontAwesome name="users" size={24} color={PERFIL_ACTION_ICON_COLOR} />
            <Text style={styles.actionLabel}>Você ainda não está em um grupo</Text>
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
            <View key={host.groupId} style={styles.hostBlock}>
              <View style={styles.infoRow}>
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
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.actionRowPressed,
                  busyGroupId !== null && styles.buttonDisabled,
                ]}
                onPress={() =>
                  void (host.isMember ? handleLeaveGroup(host) : handleJoinGroup(host))
                }
                disabled={busyGroupId !== null}
                accessibilityRole="button"
                accessibilityLabel={
                  host.isMember
                    ? `Quero sair do grupo ${host.groupName}`
                    : `Quero participar do grupo ${host.groupName}`
                }
              >
                {busyGroupId === host.groupId ? (
                  <ActivityIndicator color={PERFIL_ACTION_ICON_COLOR} size="small" />
                ) : (
                  <>
                    <FontAwesome
                      name={host.isMember ? 'sign-out' : 'user-plus'}
                      size={24}
                      color={PERFIL_ACTION_ICON_COLOR}
                    />
                    <Text style={styles.actionLabel}>
                      {host.isMember ? 'Quero sair do Grupo' : 'Quero Participar do Grupo'}
                    </Text>
                  </>
                )}
              </Pressable>
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
          <View style={styles.infoRow}>
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

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
            onPress={() => void handleOpenGuide()}
            accessibilityRole="button"
            accessibilityLabel="Roteiro da Semana"
          >
            <FontAwesome name="book" size={24} color={PERFIL_ACTION_ICON_COLOR} />
            <Text style={styles.actionLabel}>Roteiro da Semana</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.actionRowPressed,
              !group.leader?.phone && styles.buttonDisabled,
            ]}
            onPress={handleAbsence}
            disabled={!group.leader?.phone}
            accessibilityRole="button"
            accessibilityLabel="Avisar Ausência"
          >
            <FontAwesome name="whatsapp" size={24} color={PERFIL_ACTION_ICON_COLOR} />
            <Text style={styles.actionLabel}>Avisar Ausência</Text>
          </Pressable>

          {canLeaveEnrolledGroup ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionRow,
                pressed && styles.actionRowPressed,
                busyGroupId !== null && styles.buttonDisabled,
              ]}
              onPress={() => void handleLeaveEnrolledGroup()}
              disabled={busyGroupId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Quero sair do grupo ${group.name}`}
            >
              {busyGroupId === group.id ? (
                <ActivityIndicator color={PERFIL_ACTION_ICON_COLOR} size="small" />
              ) : (
                <>
                  <FontAwesome name="sign-out" size={24} color={PERFIL_ACTION_ICON_COLOR} />
                  <Text style={styles.actionLabel}>Quero sair do Grupo</Text>
                </>
              )}
            </Pressable>
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
    backgroundColor: PERFIL_ACTION_SURFACE,
    gap: 12,
  },
  title: MINIMAL_SECTION_TITLE,
  subtitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    opacity: 0.88,
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
  emptyHint: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.88,
    lineHeight: 18,
    width: '100%',
  },
  hostName: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    width: '100%',
  },
  hostMeta: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.88,
    width: '100%',
  },
  hostDistance: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    width: '100%',
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
    backgroundColor: PERFIL_ACTION_SURFACE,
  },
  hostBlock: {
    width: '100%',
    gap: 8,
  },
  actionRow: {
    width: '100%',
    maxWidth: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PERFIL_ACTION_BORDER,
    backgroundColor: PERFIL_ACTION_SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  actionRowPressed: {
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
    borderColor: VIGILANCE_SCALES_UI.border,
  },
  actionLabel: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  infoRow: {
    width: '100%',
    maxWidth: '100%',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PERFIL_ACTION_BORDER,
    backgroundColor: PERFIL_ACTION_SURFACE,
  },
  emptyInfoRow: {
    width: '50%',
    maxWidth: '50%',
    alignSelf: 'flex-start',
  },
  groupName: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    width: '100%',
  },
  meta: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.88,
    width: '100%',
  },
  address: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.88,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
