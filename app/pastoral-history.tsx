import {
  fetchMyPastoralRequests,
  formatPastoralBeneficiarySummary,
  formatPastoralRequestDate,
  formatPastoralStatusLabel,
  getSupabaseErrorMessage,
  resolvePastoralSessionProfile,
  type PastoralRequestHistoryItem,
} from '@/lib/pastoralRequest';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PastoralHistoryScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const routeUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const router = useRouter();

  useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.pastoralHistory,
    deniedMessage: 'Você não tem permissão para ver seus pedidos pastorais.',
  });

  const [profileId, setProfileId] = useState<string | null>(routeUserId ?? null);
  const [requests, setRequests] = useState<PastoralRequestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (options?: { refresh?: boolean }) => {
      const isRefresh = options?.refresh === true;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage(null);

      try {
        const session = await resolvePastoralSessionProfile(routeUserId ?? null);
        const activeProfileId = session?.userId ?? routeUserId ?? null;

        if (!activeProfileId) {
          setProfileId(null);
          setRequests([]);
          setErrorMessage('Faça login novamente para ver seus pedidos.');
          return;
        }

        setProfileId(activeProfileId);
        const items = await fetchMyPastoralRequests(activeProfileId);
        setRequests(items);
      } catch (error) {
        console.error('Erro ao carregar histórico pastoral:', error);
        setErrorMessage(getSupabaseErrorMessage(error));
        setRequests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [routeUserId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: '/pastoral',
      params: profileId ? { userId: profileId } : undefined,
    });
  };

  const handleNewRequest = () => {
    router.replace({
      pathname: '/pastoral',
      params: profileId ? { userId: profileId } : undefined,
    });
  };

  return (
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handleBack}
            style={styles.headerBackButton}>
            <Text style={styles.headerBackText}>{'‹'}</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Meus pedidos</Text>
            <Text style={styles.subtitle}>Histórico do Coração Aberto</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#C4B5FD" size="large" />
            <Text style={styles.loadingText}>Carregando pedidos...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void loadHistory()} activeOpacity={0.85}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.centered}>
            <FontAwesome name="inbox" size={40} color="#64748b" />
            <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
            <Text style={styles.emptySubtitle}>
              Quando você enviar um pedido pelo Coração Aberto, ele aparecerá aqui.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleNewRequest} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Fazer um pedido</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadHistory({ refresh: true })}
                tintColor="#C4B5FD"
              />
            }>
            {requests.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>{formatPastoralRequestDate(item.created_at)}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{formatPastoralStatusLabel(item.status)}</Text>
                  </View>
                </View>

                <Text style={styles.cardMotivo} numberOfLines={2}>
                  {item.motivo?.trim() || 'Motivo não informado'}
                </Text>
                <Text style={styles.cardSituacao} numberOfLines={2}>
                  {item.situacao?.trim() || 'Situação não informada'}
                </Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Para:</Text>
                  <Text style={styles.metaValue}>{formatPastoralBeneficiarySummary(item)}</Text>
                </View>

                {item.destination_label ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Encaminhado:</Text>
                    <Text style={styles.metaValue}>{item.destination_label}</Text>
                  </View>
                ) : null}

                {item.description?.trim() ? (
                  <Text style={styles.cardDescription} numberOfLines={3}>
                    {item.description.trim()}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}

        {!loading && !errorMessage && requests.length > 0 ? (
          <View style={styles.footerBar}>
            <TouchableOpacity style={styles.footerButton} onPress={handleNewRequest} activeOpacity={0.85}>
              <Text style={styles.footerButtonText}>Novo pedido</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  headerBackText: {
    color: '#E2E8F0',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  retryButtonText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#a855f7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  listScroll: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  cardDate: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  statusBadgeText: {
    color: '#E9D5FF',
    fontSize: 11,
    fontWeight: '800',
  },
  cardMotivo: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  cardSituacao: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  metaValue: {
    color: '#E2E8F0',
    fontSize: 12,
    flex: 1,
  },
  cardDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
  },
  footerButton: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderColor: '#a855f7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerButtonText: {
    color: '#F5F3FF',
    fontWeight: '800',
    fontSize: 15,
  },
});
