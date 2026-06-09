import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import {
  useProfilesMapMarkers,
  type ProfileForMap,
  type ProfileNotOnMap,
} from '@/hooks/useProfilesMapMarkers';
import { formatShortName } from '@/lib/formatShortName';
import { fetchCepGeolocationRecordsByDigits } from '@/lib/cepGeolocationApi';
import {
  buildProfileMapAddressDisplay,
  enrichProfileMapAddress,
  profileHasMapAddress,
} from '@/lib/enrichProfileMapAddress';
import { normalizeCepDigits } from '@/lib/geoMapGeocoding';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { DASHBOARD_MEMBERS_LIST_CARD_ID } from '@/lib/membersListModule';
import { MAP_PIN_COLOR, type MapMarker } from '@/lib/profilesMapMarkersTypes';
import { formatPhoneForDisplay } from '@/lib/totemDevice';
import { openMemberWhatsapp } from '@/lib/whatsapp';
import { ClientGeoLeafletMap } from '@/components/geo-map/ClientGeoLeafletMap.web';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type MapPinFilter = 'all' | 'members' | 'visitors';

const MAP_PIN_FILTER_OPTIONS: Array<{ id: MapPinFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'members', label: 'Com papel' },
  { id: 'visitors', label: 'Visitantes' },
];

const filterMarkersByRole = (markers: MapMarker[], filter: MapPinFilter) => {
  if (filter === 'members') {
    return markers.filter((marker) => !marker.profile.isVisitantesOnly);
  }

  if (filter === 'visitors') {
    return markers.filter((marker) => marker.profile.isVisitantesOnly);
  }

  return markers;
};

export default function MapGeolocalizacaoWebScreen() {
  const router = useRouter();

  useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.mapGeolocation,
    deniedMessage: 'Você não tem permissão para abrir o mapa de geolocalização.',
  });

  const handleBackToMembersList = useCallback(() => {
    router.replace({
      pathname: '/(tabs)/dashboard',
      params: { dashboardCard: DASHBOARD_MEMBERS_LIST_CARD_ID },
    });
  }, [router]);

  const [selectedProfile, setSelectedProfile] = useState<ProfileForMap | null>(null);
  const [pinFilter, setPinFilter] = useState<MapPinFilter>('all');
  const [invalidCepsModalVisible, setInvalidCepsModalVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const {
    loading,
    errorMessage,
    markers,
    mapCenter,
    invalidCepCount,
    profilesWithoutCepCount,
    profilesNotOnMap,
    profilesCount,
    geocoderLabel,
    fromCache,
    reload,
  } = useProfilesMapMarkers();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || typeof document === 'undefined') {
      return;
    }

    const hrefs = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];

    const links: HTMLLinkElement[] = [];
    for (const href of hrefs) {
      const existing = document.querySelector(`link[data-geo-map-css="${href}"]`) as HTMLLinkElement | null;
      if (existing) {
        continue;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-geo-map-css', href);
      document.head.appendChild(link);
      links.push(link);
    }

    return () => {
      links.forEach((link) => link.remove());
    };
  }, [isClient]);

  const leafletCenter: [number, number] = [mapCenter.latitude, mapCenter.longitude];
  const visitantePinCount = markers.filter((marker) => marker.profile.isVisitantesOnly).length;
  const memberPinCount = markers.length - visitantePinCount;

  const filteredMarkers = useMemo(
    () => filterMarkersByRole(markers, pinFilter),
    [markers, pinFilter]
  );

  const handlePinFilterChange = useCallback(
    (nextFilter: MapPinFilter) => {
      setPinFilter(nextFilter);
      setSelectedProfile((current) => {
        if (!current) {
          return null;
        }

        if (nextFilter === 'all') {
          return current;
        }

        if (nextFilter === 'members' && current.isVisitantesOnly) {
          return null;
        }

        if (nextFilter === 'visitors' && !current.isVisitantesOnly) {
          return null;
        }

        return current;
      });
    },
    []
  );

  const emptyFilterMessage =
    pinFilter === 'members'
      ? 'Nenhum perfil com papel e CEP geocodificado no mapa.'
      : pinFilter === 'visitors'
        ? 'Nenhum visitante com CEP geocodificado no mapa.'
        : null;

  const handleCloseDetails = useCallback(() => {
    setSelectedProfile(null);
  }, []);

  const handleSelectProfile = useCallback(async (profile: ProfileForMap) => {
    setSelectedProfile(profile);

    if (profileHasMapAddress(profile)) {
      return;
    }

    const cepDigits = normalizeCepDigits(profile.cep);
    if (!cepDigits) {
      return;
    }

    try {
      const cepRecords = await fetchCepGeolocationRecordsByDigits([cepDigits]);
      const enriched = enrichProfileMapAddress(profile, cepRecords);

      if (profileHasMapAddress(enriched)) {
        setSelectedProfile(enriched);
      }
    } catch {
      // Mantém o perfil original com CEP, mesmo sem endereço detalhado.
    }
  }, []);

  const selectedAddress = useMemo(
    () => (selectedProfile ? buildProfileMapAddressDisplay(selectedProfile) : null),
    [selectedProfile]
  );

  const selectedPhoneDisplay = useMemo(() => {
    const phone = selectedProfile?.phone?.trim();
    if (!phone) {
      return null;
    }

    return formatPhoneForDisplay(phone);
  }, [selectedProfile?.phone]);

  const handleOpenSelectedWhatsapp = useCallback(() => {
    if (!selectedProfile?.phone) {
      return;
    }

    void openMemberWhatsapp(selectedProfile.phone);
  }, [selectedProfile?.phone]);

  const handleOpenInvalidCepWhatsapp = useCallback((profile: ProfileNotOnMap) => {
    if (!profile.phone) {
      return;
    }

    void openMemberWhatsapp(profile.phone);
  }, []);

  const handleOpenInvalidCepsModal = useCallback(() => {
    if (!profilesNotOnMap.length) {
      return;
    }

    setInvalidCepsModalVisible(true);
  }, [profilesNotOnMap.length]);

  const handleCloseInvalidCepsModal = useCallback(() => {
    setInvalidCepsModalVisible(false);
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mapa de Geolocalização</Text>
        <TouchableOpacity onPress={handleBackToMembersList} activeOpacity={0.8}>
          <Text style={styles.headerBack}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsText}>
          Perfis: {profilesCount} · Pins: {filteredMarkers.length}
          {pinFilter !== 'all' ? ` de ${markers.length}` : ''} · Sem CEP: {profilesWithoutCepCount} ·
          Falhas: {invalidCepCount}
        </Text>
        <Text style={styles.statsHint}>{geocoderLabel}</Text>
        <View style={styles.filterRow}>
          {MAP_PIN_FILTER_OPTIONS.map((option) => {
            const count =
              option.id === 'all'
                ? markers.length
                : option.id === 'members'
                  ? memberPinCount
                  : visitantePinCount;
            const isActive = pinFilter === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.filterButton, isActive && styles.filterButtonActive]}
                onPress={() => handlePinFilterChange(option.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
                  {option.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLOR.member }]} />
            <Text style={styles.legendText}>Com papel ({memberPinCount})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLOR.visitante }]} />
            <Text style={styles.legendText}>Visitante ({visitantePinCount})</Text>
          </View>
        </View>
        {fromCache ? (
          <Text style={styles.cacheHint}>
            Dados locais em cache — sincroniza quando profiles ou papéis de acesso mudarem.
          </Text>
        ) : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.reloadButton} onPress={() => void reload()} activeOpacity={0.85}>
            <Text style={styles.reloadButtonText}>Atualizar mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.invalidCepsButton,
              !profilesNotOnMap.length && styles.invalidCepsButtonDisabled,
            ]}
            onPress={handleOpenInvalidCepsModal}
            disabled={!profilesNotOnMap.length}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.invalidCepsButtonText,
                !profilesNotOnMap.length && styles.invalidCepsButtonTextDisabled,
              ]}
            >
              Sem CEP ({profilesNotOnMap.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color="#38bdf8" />
          <Text style={styles.stateText}>Carregando mapa...</Text>
        </View>
      ) : markers.length && !isClient ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color="#38bdf8" />
          <Text style={styles.stateText}>Inicializando mapa...</Text>
        </View>
      ) : markers.length && filteredMarkers.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Nenhum pin para este filtro.</Text>
          <Text style={styles.stateText}>{emptyFilterMessage}</Text>
        </View>
      ) : markers.length && isClient ? (
        <View style={styles.mapWrap}>
          <ClientGeoLeafletMap
            center={leafletCenter}
            markers={filteredMarkers}
            onSelectProfile={(profile) => void handleSelectProfile(profile)}
          />
        </View>
      ) : (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Nenhum pin disponível no mapa.</Text>
          <Text style={styles.stateText}>
            Confirme se os perfis [GEO] foram inseridos e se profiles.cep está preenchido.
          </Text>
        </View>
      )}

      <Modal
        visible={invalidCepsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseInvalidCepsModal}
      >
        <Pressable style={styles.invalidCepsBackdrop} onPress={handleCloseInvalidCepsModal}>
          <Pressable style={styles.invalidCepsModalCard} onPress={() => undefined}>
            <View style={styles.invalidCepsModalHeader}>
              <View style={styles.invalidCepsModalHeaderText}>
                <Text style={styles.invalidCepsModalTitle}>Sem CEP / inválidos</Text>
                <Text style={styles.invalidCepsModalSubtitle}>
                  {profilesNotOnMap.length} perfil(is) sem pin no mapa
                </Text>
              </View>
              <TouchableOpacity
                style={styles.invalidCepsCloseButton}
                onPress={handleCloseInvalidCepsModal}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Fechar lista de CEPs inválidos"
              >
                <MaterialIcons name="close" size={18} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.invalidCepsScroll}
              contentContainerStyle={styles.invalidCepsScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {profilesNotOnMap.map((profile) => {
                const phoneDisplay = profile.phone ? formatPhoneForDisplay(profile.phone) : '—';

                return (
                  <View key={profile.id} style={styles.invalidCepsRow}>
                    <View style={styles.invalidCepsRowContent}>
                      <Text style={styles.invalidCepsName}>
                        {formatShortName(profile.full_name)}
                      </Text>
                      <Text style={styles.invalidCepsMeta}>
                        CEP: {profile.cepDisplay}
                        {profile.cepStatus === 'missing' ? ' · Sem CEP' : ' · CEP inválido'}
                      </Text>
                      <Text style={styles.invalidCepsMeta}>Celular: {phoneDisplay}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.invalidCepsWhatsappButton,
                        !profile.phone && styles.invalidCepsWhatsappButtonDisabled,
                      ]}
                      onPress={() => handleOpenInvalidCepWhatsapp(profile)}
                      disabled={!profile.phone}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir WhatsApp de ${formatShortName(profile.full_name)}`}
                    >
                      <FontAwesome
                        name="whatsapp"
                        size={20}
                        color={profile.phone ? '#25D366' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.invalidCepsFooterButton}
              onPress={handleCloseInvalidCepsModal}
              activeOpacity={0.85}
            >
              <Text style={styles.invalidCepsFooterButtonText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {selectedProfile && selectedAddress ? (
        <View
          style={[
            styles.detailsCard,
            selectedProfile.isVisitantesOnly ? styles.detailsCardVisitante : styles.detailsCardMember,
          ]}
        >
          <View style={styles.detailsHeader}>
            <View style={styles.detailsHeaderText}>
              <Text style={styles.detailsTitle}>{selectedProfile.full_name ?? 'Sem nome'}</Text>
              <Text style={styles.detailsBadge}>
                {selectedProfile.roleLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.detailsCloseButton}
              onPress={handleCloseDetails}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhes do pin"
            >
              <MaterialIcons name="close" size={18} color="#E2E8F0" />
            </TouchableOpacity>
          </View>
          <Text style={styles.detailsText}>CEP: {selectedAddress.cepLine}</Text>
          {selectedAddress.hasAddress ? (
            <>
              {selectedAddress.streetLine ? (
                <Text style={styles.detailsText}>{selectedAddress.streetLine}</Text>
              ) : null}
              {selectedAddress.locationLine ? (
                <Text style={styles.detailsText}>{selectedAddress.locationLine}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.detailsHint}>
              Endereço não cadastrado no perfil. Atualize o CEP no cadastro do usuário.
            </Text>
          )}
          <View style={styles.detailsPhoneRow}>
            <Text style={styles.detailsText}>
              Telefone: {selectedPhoneDisplay ?? '—'}
            </Text>
            <TouchableOpacity
              style={[
                styles.detailsWhatsappButton,
                !selectedProfile.phone && styles.detailsWhatsappButtonDisabled,
              ]}
              onPress={handleOpenSelectedWhatsapp}
              disabled={!selectedProfile.phone}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Abrir WhatsApp do membro"
            >
              <FontAwesome
                name="whatsapp"
                size={18}
                color={selectedProfile.phone ? '#25D366' : '#64748B'}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  headerBack: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '700',
  },
  statsCard: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 10,
    gap: 6,
  },
  statsText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  statsHint: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  filterButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterButtonActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  filterButtonText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: '#E0F2FE',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  legendText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  cacheHint: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  reloadButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reloadButtonText: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
  },
  invalidCepsButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  invalidCepsButtonDisabled: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  invalidCepsButtonText: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '700',
  },
  invalidCepsButtonTextDisabled: {
    color: '#64748B',
  },
  invalidCepsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    padding: 16,
  },
  invalidCepsModalCard: {
    maxHeight: '82%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    padding: 14,
    gap: 10,
  },
  invalidCepsModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  invalidCepsModalHeaderText: {
    flex: 1,
    gap: 4,
  },
  invalidCepsModalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  invalidCepsModalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  invalidCepsCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
  },
  invalidCepsScroll: {
    maxHeight: 420,
  },
  invalidCepsScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  invalidCepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  invalidCepsRowContent: {
    flex: 1,
    gap: 2,
  },
  invalidCepsName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  invalidCepsMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  invalidCepsWhatsappButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  invalidCepsWhatsappButtonDisabled: {
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  invalidCepsFooterButton: {
    alignSelf: 'stretch',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  invalidCepsFooterButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  mapWrap: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 360 : 260,
    width: '100%',
    backgroundColor: '#0f172a',
    ...(Platform.OS === 'web'
      ? ({
          height: '58vh',
          minHeight: 360,
        } as const)
      : null),
  },
  stateBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 24,
  },
  stateTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailsCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    padding: 12,
    gap: 6,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailsHeaderText: {
    flex: 1,
    gap: 4,
  },
  detailsCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  detailsCardMember: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  detailsCardVisitante: {
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  detailsTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  detailsBadge: {
    alignSelf: 'flex-start',
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  detailsText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  detailsHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  detailsPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  detailsWhatsappButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  detailsWhatsappButtonDisabled: {
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
});
