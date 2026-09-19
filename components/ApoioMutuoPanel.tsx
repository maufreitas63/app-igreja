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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  panelHeight: number;
  isActive?: boolean;
};

export function ApoioMutuoPanel({ panelHeight, isActive = true }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ProfileServiceCard[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategoria | 'todas'>('todas');
  const [detail, setDetail] = useState<ProfileServiceCard | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      await loadEffectiveSessionProfile();
      const serviceCards = await fetchProfileServicesMural();
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
      setServices([]);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o Apoio Mútuo.');
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

  return (
    <View style={[styles.panel, { maxHeight: contentHeight }]}>
      <KnowledgeSectionTitle
        title="Apoio Mútuo"
        routeKey={KNOWLEDGE_ROUTE.apoioMutuo}
        titleStyle={maintenancePanelStyles.panelTitle}
      />
      <Text style={styles.subtitle}>
        Serviços oferecidos pelos membros desta igreja. Cadastre o seu em Perfil → Ofereço meus
        Serviços.
      </Text>

      {loading ? (
        <ActivityIndicator color="#1E3A5F" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : services.length === 0 ? (
        <Text style={styles.empty}>Ainda não há serviços publicados nesta igreja.</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
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
});
