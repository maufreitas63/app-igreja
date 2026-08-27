import { SmallGroupGuideModal } from '@/components/SmallGroupGuideModal';
import { buildProfileMapNavigationAddressLine } from '@/lib/enrichProfileMapAddress';
import { formatShortName } from '@/lib/formatShortName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
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
    // ProteÃ§Ã£o aplicada: no Ghost o card segue o alvo, nÃ£o o operador
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
      setError(loadError instanceof Error ? loadError.message : 'NÃ£o foi possÃ­vel carregar o grupo.');
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
        Alert.alert('EndereÃ§o indisponÃ­vel', 'O anfitriÃ£o ainda nÃ£o tem endereÃ§o cadastrado.');
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
        guideError instanceof Error ? guideError.message : 'NÃ£o foi possÃ­vel abrir o roteiro.'
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
                  joinError instanceof Error ? joinError.message : 'NÃ£o foi possÃ­vel participar.'
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
      Alert.alert('LÃ­der sem celular', 'NÃ£o hÃ¡ telefone cadastrado para o lÃ­der deste grupo.');
      return;
    }

    const message = `OlÃ¡ ${group.leader.full_name ?? 'lÃ­der'}, sou ${memberName} e nÃ£o poderei participar do pequeno grupo ${group.name} nesta semana.`;
    openWhatsAppLikeBirthdaysWithText(group.leader.phone, message);
  }, [group, memberName]);

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Pequeno Grupo</Text>
      <Text style={styles.subtitle}>CÃ©lula da sua jornada em comunidade.</Text>

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
            <Text style={styles.emptyTitle}>VocÃª ainda nÃ£o estÃ¡ em um grupo</Text>
            {nearbyHosts.length === 0 ? (
              <Text style={styles.emptyHint}>
                NÃ£o existe nenhum anfitriÃ£o disponÃ­vel para alocaÃ§Ã£o.
              </Text>
            ) : (
              <>
                <Text style={styles.emptyHint}>
                  AnfitriÃµes mais prÃ³ximos da sua residÃªncia, da menor para a maior distÃ¢ncia.
                </Text>
                {hasMemberLocation ? null : (
                  <Text style={styles.emptyHint}>
                    Cadastre o CEP no seu perfil para calcular a distÃ¢ncia atÃ© cada anfitriÃ£o.
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
                ReuniÃµes: {formatSmallGroupWeekday(host.meetingWeekday)}
                {host.meetingTime ? ` Â· ${host.meetingTime}` : ''}
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
              {formatSmallGroupWeekday(group.meeting_weekday)} Â· {group.meeting_time || 'â€”'}
            </Text>
            <Text style={styles.meta}>
              LÃ­der: {group.leader?.full_name ?? 'â€”'}
            </Text>
            <Text style={styles.meta}>
              AnfitriÃ£o: {group.host?.full_name ?? 'â€”'}
            </Text>
            <Text style={styles.address} numberOfLines={3}>
              {hostAddress ?? 'EndereÃ§o do anfitriÃ£o ainda nÃ£o cadastrado.'}
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
            <Text style={styles.buttonText}>Avisar AusÃªncia</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <SmallGroupGuideModal visible={guideOpen} guide={guide} onClose={() => setGuideOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    gap: 8,
  },
  subtitle: {
    ...CONTAIN_WIDTH,
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
  errorText: {
    ...CONTAIN_WIDTH,
    color: '#B91C1C',
    textAlign: 'center',
    fontSize: 13,
  },
  emptyCard: {
    ...CONTAIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyTitle: {
    ...CONTAIN_WIDTH,
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    ...CONTAIN_WIDTH,
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  hostCard: {
    ...CONTAIN_WIDTH,
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
    ...CONTAIN_WIDTH,
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
    ...CONTAIN_WIDTH,
    flex: 1,
  },
  scrollContent: {
    ...CONTAIN_WIDTH,
    gap: 10,
    paddingBottom: 8,
    flexGrow: 1,
    alignItems: 'stretch',
  },
  bodyCard: {
    ...CONTAIN_WIDTH,
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
    ...CONTAIN_WIDTH,
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    flex: 1,
    minWidth: 0,
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
    ...CONTAIN_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 11,
  },
  absenceButton: {
    ...CONTAIN_WIDTH,
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
    textAlign: 'center',
  },
});
