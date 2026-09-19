import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { ServiceBusinessCard } from '@/components/ServiceBusinessCard';
import { ServiceMuralDetailModal } from '@/components/ServiceMuralDetailModal';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchProfileServicesMural,
  SERVICE_CATEGORIA_LABEL,
  SERVICE_CATEGORIES,
  type ProfileServiceCard,
  type ServiceCategoria,
} from '@/lib/profileServicesApi';
import { resolveSelfiePreviewUrl } from '@/lib/selfie';
import {
  expressVolunteerOpportunityInterest,
  fetchVolunteerOpportunitiesForMe,
  type VolunteerOpportunityMember,
} from '@/lib/volunteerOpportunitiesApi';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';
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

export function OpportunityMuralCard({ panelHeight, isActive = true }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VolunteerOpportunityMember[]>([]);
  const [services, setServices] = useState<ProfileServiceCard[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategoria | 'todas'>('todas');
  const [detail, setDetail] = useState<ProfileServiceCard | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      await loadEffectiveSessionProfile();
      const [vacancies, serviceCards] = await Promise.all([
        fetchVolunteerOpportunitiesForMe(),
        fetchProfileServicesMural().catch(() => [] as ProfileServiceCard[]),
      ]);
      setRows(vacancies);
      setServices(serviceCards);

      const photoEntries = await Promise.all(
        serviceCards.map(async (card) => {
          if (!card.selfieUrl) {
            return null;
          }

          try {
            const url = await resolveSelfiePreviewUrl(card.selfieUrl);
            return url ? ([card.id, url] as const) : null;
          } catch {
            return null;
          }
        })
      );

      const nextPhotos: Record<string, string> = {};
      for (const entry of photoEntries) {
        if (entry) {
          nextPhotos[entry[0]] = entry[1];
        }
      }
      setPhotos(nextPhotos);
    } catch (loadError) {
      setRows([]);
      setServices([]);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o mural.');
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

  const forYou = useMemo(() => rows.filter((row) => row.isPrimaryMatch), [rows]);
  const others = useMemo(() => rows.filter((row) => !row.isPrimaryMatch), [rows]);
  const visibleServices = useMemo(
    () =>
      categoryFilter === 'todas'
        ? services
        : services.filter((card) => card.categoria === categoryFilter),
    [categoryFilter, services]
  );
  const usedCategories = useMemo(() => {
    const present = new Set(services.map((card) => card.categoria));
    return SERVICE_CATEGORIES.filter((item) => present.has(item.value));
  }, [services]);

  const handleInterest = async (row: VolunteerOpportunityMember) => {
    setBusyId(row.id);

    try {
      const result = await expressVolunteerOpportunityInterest(row.id);

      if (!result.success) {
        Alert.alert('Mural', result.message);
        return;
      }

      const whatsappPhone = normalizePhoneForWhatsApp(row.leaderPhone);

      if (!whatsappPhone) {
        Alert.alert('Mural', `${result.message} O líder ainda não tem telefone cadastrado.`);
        await load();
        return;
      }

      const text = encodeURIComponent(
        `Olá! Vi a vaga "${row.titulo}" no mural e tenho interesse em servir.`
      );
      await Linking.openURL(`https://wa.me/${whatsappPhone}?text=${text}`);
      await load();
    } catch (interestError) {
      Alert.alert(
        'Mural',
        interestError instanceof Error ? interestError.message : 'Não foi possível registrar o interesse.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const showMatchedSection = forYou.length > 0;
  const emptyMural = services.length === 0 && rows.length === 0;

  return (
    <View style={[styles.panel, { maxHeight: contentHeight }]}>
      <KnowledgeSectionTitle
        title="Mural de Oportunidades"
        routeKey={KNOWLEDGE_ROUTE.muralOportunidades}
        titleStyle={maintenancePanelStyles.panelTitle}
      />
      <Text style={styles.subtitle}>
        Cartões de serviço desta igreja e vagas para servir. Cadastre o seu em Perfil → Dados
        Cadastrais.
      </Text>

      {loading ? (
        <ActivityIndicator color="#1E3A5F" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : emptyMural ? (
        <Text style={styles.empty}>Ainda não há serviços nem vagas publicados nesta igreja.</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {services.length > 0 ? (
            <>
              <Text style={styles.section}>Serviços da comunidade</Text>
              {usedCategories.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  <CategoryChip
                    label="Todas"
                    selected={categoryFilter === 'todas'}
                    onPress={() => setCategoryFilter('todas')}
                  />
                  {usedCategories.map((item) => (
                    <CategoryChip
                      key={item.value}
                      label={SERVICE_CATEGORIA_LABEL[item.value]}
                      selected={categoryFilter === item.value}
                      onPress={() => setCategoryFilter(item.value)}
                    />
                  ))}
                </ScrollView>
              ) : null}
              {visibleServices.length === 0 ? (
                <Text style={styles.empty}>Nenhum serviço nesta categoria.</Text>
              ) : (
                visibleServices.map((card) => (
                  <ServiceBusinessCard
                    key={card.id}
                    card={card}
                    photoUrl={photos[card.id]}
                    onOpenDetail={() => setDetail(card)}
                  />
                ))
              )}
            </>
          ) : null}

          {rows.length > 0 ? (
            <>
              {showMatchedSection ? (
                <>
                  <Text style={styles.section}>Vagas para você</Text>
                  {forYou.map((row) => (
                    <OpportunityCard
                      key={row.id}
                      row={row}
                      busy={busyId === row.id}
                      showSeal
                      onInterest={() => void handleInterest(row)}
                    />
                  ))}
                  {others.length ? <Text style={styles.section}>Outras vagas abertas</Text> : null}
                </>
              ) : (
                <Text style={styles.section}>Vagas para servir</Text>
              )}
              {(showMatchedSection ? others : rows).map((row) => (
                <OpportunityCard
                  key={row.id}
                  row={row}
                  busy={busyId === row.id}
                  showSeal={false}
                  onInterest={() => void handleInterest(row)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      <ServiceMuralDetailModal
        visible={Boolean(detail)}
        card={detail}
        photoUrl={detail ? photos[detail.id] : null}
        onClose={() => setDetail(null)}
      />
    </View>
  );
}

function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function OpportunityCard({
  row,
  busy,
  showSeal,
  onInterest,
}: {
  row: VolunteerOpportunityMember;
  busy: boolean;
  showSeal: boolean;
  onInterest: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{row.titulo}</Text>
        {showSeal ? (
          <Text style={styles.seal}>
            Match de {Math.max(Number.isFinite(row.matchPct) ? row.matchPct : 0, 80)}%
          </Text>
        ) : null}
      </View>
      {row.ministerioNome ? <Text style={styles.meta}>{row.ministerioNome}</Text> : null}
      {row.descricao ? (
        <Text style={styles.body} numberOfLines={4}>
          {row.descricao}
        </Text>
      ) : null}
      {row.myInterest ? (
        <Text style={styles.interest}>Interesse: {row.myInterest}</Text>
      ) : (
        <TouchableOpacity style={styles.primary} onPress={onInterest} disabled={busy} activeOpacity={0.85}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryText}>Tenho Interesse</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  loader: {
    marginTop: 24,
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
    paddingBottom: 12,
  },
  chips: {
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  chipSelected: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  chipText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: MINIMAL_UI.onDark,
  },
  section: {
    color: '#1E3A5F',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: '#1E3A5F',
    fontSize: 15,
    fontWeight: '800',
  },
  seal: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  interest: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  primary: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
