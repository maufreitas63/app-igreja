import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  fetchActiveCampaignProjects,
  formatCampaignCentsHint,
  formatCampaignProgressLabel,
  type CampaignProject,
} from '@/lib/campaignProjectsApi';
import { withReturnDashboardCard } from '@/lib/dashboardReturnNavigation';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

const POLL_MS = 15_000;

export function CampaignCard({ panelHeight, isActive = true }: Props) {
  const router = useRouter();
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Proteção aplicada: no Ghost o card segue o alvo, não o operador
    setError(null);

    try {
      await loadEffectiveSessionProfile();
      setCampaigns(await fetchActiveCampaignProjects());
    } catch (loadError) {
      setCampaigns([]);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as campanhas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [isActive, load]);

  const handleContribute = (campaign: CampaignProject) => {
    void navigateWithScreenAccess(
      router,
      '/ofertas',
      ACCESS_DASHBOARD_CARD.offerings,
      withReturnDashboardCard('campaign_card', { campaignId: campaign.id }),
      { deniedMessage: 'Você não tem permissão para abrir Dízimos e Ofertas.' }
    );
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Campanhas e Projetos</Text>
      <Text style={styles.subtitle}>Acompanhe metas específicas com transparência em tempo real.</Text>

      {loading ? (
        <ActivityIndicator color="#1E3A5F" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : campaigns.length === 0 ? (
        <Text style={styles.empty}>Nenhuma campanha ativa no momento.</Text>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {campaigns.map((campaign) => {
            const pct = Math.max(0, Math.min(100, campaign.progress_pct));

            return (
              <View key={campaign.id} style={styles.card}>
                {campaign.cover_url ? (
                  <Image source={{ uri: campaign.cover_url }} style={styles.cover} />
                ) : null}
                <Text style={styles.title}>{campaign.titulo}</Text>
                {campaign.descricao ? (
                  <Text style={styles.description} numberOfLines={3}>
                    {campaign.descricao}
                  </Text>
                ) : null}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {formatCampaignProgressLabel(
                    campaign.valor_arrecadado,
                    campaign.meta_financeira,
                    campaign.progress_pct
                  )}
                </Text>
                <Text style={styles.centsHint}>{formatCampaignCentsHint(campaign.centavos_referencia)}</Text>
                <TouchableOpacity
                  style={styles.contribute}
                  onPress={() => handleContribute(campaign)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.contributeText}>Contribuir Agora</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
    minHeight: 0,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  empty: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 12,
    paddingBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  cover: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  title: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  description: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
  },
  progressLabel: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  centsHint: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  contribute: {
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  contributeText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
