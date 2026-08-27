import { SmallGroupGuideModal } from '@/components/SmallGroupGuideModal';
import { buildProfileMapNavigationAddressLine } from '@/lib/enrichProfileMapAddress';
import { formatShortName } from '@/lib/formatShortName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  fetchCurrentSmallGroupGuide,
  fetchMySmallGroup,
  fetchNearbySmallGroupHosts,
  formatSmallGroupHostDistanceMeters,
  formatSmallGroupMemberCount,
  formatSmallGroupWeekday,
  joinSmallGroupAsMember,
  type MySmallGroup,
  type NearbySmallGroupHost,
  type SmallGroupGuide,
} from '@/lib/smallGroupsApi';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

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

  const openMaps = useCallback(
    async (provider: 'google' | 'waze') => {
      if (!hostAddress) {
        Alert.alert('Endereço indisponível', 'O anfitrião ainda não tem endereço cadastrado.');
        return;
      }

      const encoded = encodeURIComponent(hostAddress);
      const url =
        provider === 'waze'
          ? `https://waze.com/ul?q=${encoded}&navigate=yes`
          : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

      await Linking.openURL(url);
    },
    [hostAddress]
  );

  const handleOpenGuide = useCallback(async () => {
    try {
      const nextGuide = await fetchCurrentSmallGroupGuide();
      setGuide(nextGuide);
      setGuideOpen(true);
    } catch (guideError) {
      Alert.alert(
        'Roteiro da Semana',
        guideError instanceof Error ? guideError.message : 'Não foi possível abrir o roteiro.'
      );
    }
  }, []);

  const handleJoinGroup = useCallback((host: NearbySmallGroupHost) => {
    Alert.alert(
      'Participar do grupo',
      `Deseja se inscrever em "${host.groupName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            void (async () => {
              setJoiningGroupId(host.groupId);

              try {
                const result = await joinSmallGroupAsMember(host.groupId);
                Alert.alert('Pequeno grupo', result.message);

                if (result.success) {
                  await load();
                }
              } catch (joinError) {
                Alert.alert(
                  'Pequeno grupo',
                  joinError instanceof Error ? joinError.message : 'Não foi possível participar.'
                );
              } finally {
                setJoiningGroupId(null);
              }
            })();
          },
        },
      ]
    );
  }, [load]);

  const handleAbsence = useCallback(() => {
    if (!group?.leader?.phone) {
      Alert.alert('Líder sem celular', 'Não há telefone cadastrado para o líder deste grupo.');
      return;
    }

    const message = `Olá ${group.leader.full_name ?? 'líder'}, sou ${memberName} e não poderei participar do pequeno grupo ${group.name} nesta semana.`;
    openWhatsAppLikeBirthdaysWithText(group.leader.phone, message);
  }, [group, memberName]);

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
          showsVerticalScrollIndicator={false}
        >
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
                  styles.joinButton,
                  joiningGroupId !== null && styles.buttonDisabled,
                ]}
                onPress={() => handleJoinGroup(host)}
                disabled={joiningGroupId !== null}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Quero participar do grupo ${host.groupName}`}
              >
                {joiningGroupId === host.groupId ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Quero Participar do Grupo</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bodyCard}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.meta}>
              {formatSmallGroupWeekday(group.meeting_weekday)} · {group.meeting_time || '—'}
            </Text>
            <Text style={styles.meta}>
              Líder: {group.leader?.full_name ?? '—'}
            </Text>
            <Text style={styles.meta}>
              Anfitrião: {group.host?.full_name ?? '—'}
            </Text>
            <Text style={styles.address} numberOfLines={3}>
              {hostAddress ?? 'Endereço do anfitrião ainda não cadastrado.'}
            </Text>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.mapButton, !hostAddress && styles.buttonDisabled]}
              onPress={() => void openMaps('google')}
              disabled={!hostAddress}
              activeOpacity={0.85}
            >
              <MaterialIcons name="map" size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapButton, styles.wazeButton, !hostAddress && styles.buttonDisabled]}
              onPress={() => void openMaps('waze')}
              disabled={!hostAddress}
              activeOpacity={0.85}
            >
              <FontAwesome name="location-arrow" size={14} color="#FFFFFF" />
              <Text style={styles.buttonText}>Waze</Text>
            </TouchableOpacity>
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
        </ScrollView>
      )}

      <SmallGroupGuideModal visible={guideOpen} guide={guide} onClose={() => setGuideOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    gap: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
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
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
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
    marginTop: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  bodyCard: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
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
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 10,
  },
  wazeButton: {
    backgroundColor: '#33CCFF',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 11,
  },
  absenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingVertical: 11,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
