import { MembersListsClass } from '@/components/MembersListsClass';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MAP_PIN_DETAIL_DENIED_MESSAGE, useMapPinDetailAccess } from '@/hooks/useMapPinDetailAccess';
import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { DASHBOARD_SCREEN_DENIED_MESSAGES, navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { normalizeFamilyCode } from '@/lib/family';
import {
  loadMembersListsClassMembers,
  loadMembersListsClassInactiveMembers,
  loadMembersListsClassCongregados,
  loadMembersListsClassVisitors,
} from '@/lib/membersListsClassData';
import type {
  MembersListsClassAudience,
  MembersListsClassEntry,
} from '@/lib/membersListsClassTypes';
import { filterMembersListsClassEntries } from '@/lib/membersListsClassUtils';
import {
  fetchFamilyMembersForDirectoryEntry,
  type FamilyDirectoryMember,
} from '@/lib/membersListApi';
import { prefetchProfilesMapMarkers } from '@/lib/syncProfilesMapMarkers';
import { openMemberWhatsapp } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

/** Container com dados e navegação — compõe o MembersListsClass stateless. */
export function MembersListsClassPanel() {
  const router = useRouter();
  const visitorsListLoadedRef = useRef(false);
  const inactiveMembersLoadedRef = useRef(false);
  const congregadosLoadedRef = useRef(false);

  const [audience, setAudience] = useState<MembersListsClassAudience>('active_members');
  const [memberEntries, setMemberEntries] = useState<MembersListsClassEntry[]>([]);
  const [inactiveMemberEntries, setInactiveMemberEntries] = useState<MembersListsClassEntry[]>([]);
  const [congregadoEntries, setCongregadoEntries] = useState<MembersListsClassEntry[]>([]);
  const [visitorEntries, setVisitorEntries] = useState<MembersListsClassEntry[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInactiveMembers, setLoadingInactiveMembers] = useState(false);
  const [loadingCongregados, setLoadingCongregados] = useState(false);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [canAccessMapGeolocation, setCanAccessMapGeolocation] = useState(false);

  const [familyModalSeedEntry, setFamilyModalSeedEntry] = useState<MembersListsClassEntry | null>(null);
  const [familyModalFamilyId, setFamilyModalFamilyId] = useState<string | null>(null);
  const [familyModalMembers, setFamilyModalMembers] = useState<FamilyDirectoryMember[]>([]);
  const [familyModalError, setFamilyModalError] = useState<string | null>(null);
  const [isFamilyModalLoading, setIsFamilyModalLoading] = useState(false);

  const { canViewMapPinDetails } = useMapPinDetailAccess();

  const isMapGeolocationEnabled = useMemo(
    () => canAccessMapGeolocation && Platform.OS === 'web',
    [canAccessMapGeolocation]
  );

  const mapGeolocationDisabledMessage = useMemo(() => {
    if (Platform.OS !== 'web') {
      return 'O mapa está disponível apenas na versão web (PWA).';
    }

    return (
      DASHBOARD_SCREEN_DENIED_MESSAGES[ACCESS_SCREEN.mapGeolocation]
      ?? 'Você não tem permissão para abrir o mapa de geolocalização.'
    );
  }, []);

  const activeEntries = useMemo(() => {
    if (audience === 'visitors') return visitorEntries;
    if (audience === 'congregados') return congregadoEntries;
    if (audience === 'inactive_members') return inactiveMemberEntries;
    return memberEntries;
  }, [audience, congregadoEntries, inactiveMemberEntries, memberEntries, visitorEntries]);

  const isActiveLoading =
    audience === 'visitors'
      ? loadingVisitors
      : audience === 'congregados'
        ? loadingCongregados
        : audience === 'inactive_members'
          ? loadingInactiveMembers
          : loadingMembers;

  const filteredEntries = useMemo(
    () => filterMembersListsClassEntries(activeEntries, searchQuery),
    [activeEntries, searchQuery]
  );

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setError(null);

    try {
      const loaded = await loadMembersListsClassMembers();
      setMemberEntries(loaded);
    } catch (loadError) {
      console.error('Erro ao carregar lista de membros:', loadError);
      setMemberEntries([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Nao foi possivel carregar a lista de membros.'
      );
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const loadInactiveMembers = useCallback(async () => {
    setLoadingInactiveMembers(true);
    setError(null);

    try {
      const loaded = await loadMembersListsClassInactiveMembers();
      setInactiveMemberEntries(loaded);
      inactiveMembersLoadedRef.current = true;
    } catch (loadError) {
      console.error('Erro ao carregar lista de membros inativos:', loadError);
      setInactiveMemberEntries([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Nao foi possivel carregar a lista de membros inativos.'
      );
    } finally {
      setLoadingInactiveMembers(false);
    }
  }, []);

  const loadCongregados = useCallback(async () => {
    setLoadingCongregados(true);
    setError(null);

    try {
      const loaded = await loadMembersListsClassCongregados();
      setCongregadoEntries(loaded);
      congregadosLoadedRef.current = true;
    } catch (loadError) {
      console.error('Erro ao carregar lista de congregados:', loadError);
      setCongregadoEntries([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Nao foi possivel carregar a lista de congregados.'
      );
    } finally {
      setLoadingCongregados(false);
    }
  }, []);

  const loadVisitors = useCallback(async () => {
    setLoadingVisitors(true);
    setError(null);

    try {
      const loaded = await loadMembersListsClassVisitors();
      setVisitorEntries(loaded);
      visitorsListLoadedRef.current = true;
    } catch (loadError) {
      console.error('Erro ao carregar lista de visitantes:', loadError);
      setVisitorEntries([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Nao foi possivel carregar a lista de visitantes.'
      );
    } finally {
      setLoadingVisitors(false);
    }
  }, []);

  const refreshActiveList = useCallback(async () => {
    if (audience === 'visitors') {
      await loadVisitors();
      return;
    }

    if (audience === 'congregados') {
      await loadCongregados();
      return;
    }

    if (audience === 'inactive_members') {
      await loadInactiveMembers();
      return;
    }

    await loadMembers();
  }, [audience, loadCongregados, loadInactiveMembers, loadMembers, loadVisitors]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    void sessionHasAccess('screen', ACCESS_SCREEN.mapGeolocation, 'view').then(setCanAccessMapGeolocation);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void refreshActiveList();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshActiveList]);

  useEffect(() => {
    if (!familyModalSeedEntry) {
      setFamilyModalFamilyId(null);
      setFamilyModalMembers([]);
      setFamilyModalError(null);
      setIsFamilyModalLoading(false);
      return;
    }

    let cancelled = false;
    setFamilyModalFamilyId(normalizeFamilyCode(familyModalSeedEntry.family_id) || null);
    setFamilyModalMembers([]);
    setFamilyModalError(null);
    setIsFamilyModalLoading(true);

    void (async () => {
      try {
        const { familyId, members } = await fetchFamilyMembersForDirectoryEntry(
          familyModalSeedEntry,
          { visitorsOnly: audience === 'visitors' }
        );

        if (cancelled) {
          return;
        }

        setFamilyModalFamilyId(familyId);
        setFamilyModalMembers(members);

        if (!members.length) {
          setFamilyModalError(
            familyId
              ? `Nenhum integrante encontrado para a família ${familyId}. Verifique se scripts/members-list-family-sync.sql foi aplicado no Supabase.`
              : 'Código familiar não identificado para este integrante.'
          );
        }
      } catch (loadError) {
        console.error('Erro ao carregar membros da família:', loadError);

        if (!cancelled) {
          setFamilyModalFamilyId(normalizeFamilyCode(familyModalSeedEntry.family_id) || null);
          setFamilyModalMembers([]);
          setFamilyModalError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar os membros da família.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsFamilyModalLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audience, familyModalSeedEntry]);

  const handleAudienceChange = useCallback(
    (nextAudience: MembersListsClassAudience) => {
      setAudience(nextAudience);
      setSearchQuery('');
      setError(null);

      if (nextAudience === 'visitors' && !visitorsListLoadedRef.current) {
        void loadVisitors();
      }

      if (nextAudience === 'congregados' && !congregadosLoadedRef.current) {
        void loadCongregados();
      }

      if (nextAudience === 'inactive_members' && !inactiveMembersLoadedRef.current) {
        void loadInactiveMembers();
      }
    },
    [loadCongregados, loadInactiveMembers, loadVisitors]
  );

  const handleOpenMembersMap = useCallback(() => {
    if (!isMapGeolocationEnabled) {
      Toast.show({
        type: 'error',
        text1: 'Mapa indisponível',
        text2: mapGeolocationDisabledMessage,
        visibilityTime: 3500,
      });
      return;
    }

    prefetchProfilesMapMarkers();
    void navigateWithScreenAccess(
      router,
      '/mapa-geolocalizacao',
      ACCESS_SCREEN.mapGeolocation,
      withReturnRoute('/membros')
    );
  }, [isMapGeolocationEnabled, mapGeolocationDisabledMessage, router]);

  const handleOpenEntryMap = useCallback(
    (entry: MembersListsClassEntry) => {
      if (!isMapGeolocationEnabled) {
        Toast.show({
          type: 'error',
          text1: 'Mapa indisponível',
          text2: mapGeolocationDisabledMessage,
          visibilityTime: 3500,
        });
        return;
      }

      if (!canViewMapPinDetails) {
        Toast.show({
          type: 'info',
          text1: 'Detalhe indisponível',
          text2: MAP_PIN_DETAIL_DENIED_MESSAGE,
          visibilityTime: 4000,
        });
        return;
      }

      if (!entry.cep?.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Mapa indisponível',
          text2: 'Este membro não possui CEP cadastrado para exibir no mapa.',
          visibilityTime: 3500,
        });
        return;
      }

      prefetchProfilesMapMarkers();
      void navigateWithScreenAccess(
        router,
        '/mapa-geolocalizacao',
        ACCESS_SCREEN.mapGeolocation,
        withReturnRoute('/membros', { focusProfileId: entry.id })
      );
    },
    [canViewMapPinDetails, isMapGeolocationEnabled, mapGeolocationDisabledMessage, router]
  );

  const handleOpenFamily = useCallback((entry: MembersListsClassEntry) => {
    setFamilyModalSeedEntry(entry);
    setFamilyModalFamilyId(normalizeFamilyCode(entry.family_id) || null);
    setFamilyModalMembers([]);
    setFamilyModalError(null);
  }, []);

  const handleOpenWhatsapp = useCallback((entry: MembersListsClassEntry) => {
    void openMemberWhatsapp(entry.phone);
  }, []);

  return (
    <View style={styles.root}>
      <MembersListsClass
        audience={audience}
        loading={isActiveLoading}
        error={error}
        onRetry={() => void refreshActiveList()}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        entries={filteredEntries}
        totalCount={activeEntries.length}
        mapEnabled={isMapGeolocationEnabled}
        canViewMapPinDetails={canViewMapPinDetails}
        onAudienceChange={handleAudienceChange}
        onOpenMap={handleOpenMembersMap}
        onOpenFamily={handleOpenFamily}
        onOpenWhatsapp={handleOpenWhatsapp}
        onOpenEntryMap={handleOpenEntryMap}
      />

      <Modal
        visible={familyModalSeedEntry !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFamilyModalSeedEntry(null)}
      >
        <Pressable style={styles.familyBackdrop} onPress={() => setFamilyModalSeedEntry(null)}>
          <Pressable style={styles.familyModalCard} onPress={() => undefined}>
            <Text style={styles.familyModalTitle}>Membros da família</Text>
            {familyModalFamilyId ? (
              <Text style={styles.familyModalSubtitle}>Família {familyModalFamilyId}</Text>
            ) : null}
            <ScrollView
              style={styles.familyModalScroll}
              contentContainerStyle={styles.familyModalScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {isFamilyModalLoading ? (
                <View style={styles.familyModalLoading}>
                  <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} />
                </View>
              ) : familyModalError ? (
                <Text style={styles.familyModalErrorText}>{familyModalError}</Text>
              ) : familyModalMembers.length === 0 ? (
                <Text style={styles.familyModalEmptyText}>
                  Nenhum membro reconhecido nesta família.
                </Text>
              ) : null}
              {familyModalMembers.map((member) => (
                <View key={member.id} style={styles.familyModalRow}>
                  <View style={styles.familyModalRowContent}>
                    <Text style={styles.familyModalName}>{member.full_name}</Text>
                    {member.relationship ? (
                      <Text style={styles.familyModalRelationship}>{member.relationship}</Text>
                    ) : null}
                  </View>
                  {member.phone ? (
                    <TouchableOpacity
                      style={styles.familyModalWhatsappButton}
                      onPress={() => void openMemberWhatsapp(member.phone)}
                      activeOpacity={0.85}
                    >
                      <FontAwesome name="whatsapp" size={20} color="#25D366" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.familyCloseButton}
              onPress={() => setFamilyModalSeedEntry(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.familyCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  familyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  familyModalCard: {
    maxHeight: '70%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
    gap: 10,
  },
  familyModalTitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  familyModalSubtitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },
  familyModalScroll: {
    maxHeight: 280,
  },
  familyModalScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  familyModalLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  familyModalErrorText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingVertical: 12,
  },
  familyModalEmptyText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  familyModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  familyModalRowContent: {
    flex: 1,
    minWidth: 0,
  },
  familyModalName: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  familyModalWhatsappButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyModalRelationship: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
    opacity: 0.85,
  },
  familyCloseButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  familyCloseButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
