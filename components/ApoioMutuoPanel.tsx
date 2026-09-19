import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { ServiceBusinessCard } from '@/components/ServiceBusinessCard';
import { ServiceMuralDetailModal } from '@/components/ServiceMuralDetailModal';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
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
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

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

  useFocusEffect(
    useCallback(() => {
      if (!isActive) {
        return;
      }

      void load();
    }, [isActive, load])
  );

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
  const categoryOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas as categorias' },
      ...usedCategories.map((item) => ({
        value: item.value,
        label: SERVICE_CATEGORIA_LABEL[item.value],
      })),
    ],
    [usedCategories]
  );

  return (
    <View style={[styles.panel, { maxHeight: contentHeight }]}>
      <KnowledgeSectionTitle
        title="Apoio Mútuo"
        routeKey={KNOWLEDGE_ROUTE.apoioMutuo}
        titleStyle={maintenancePanelStyles.panelTitle}
      />
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Quem caminha junto, cresce junto.</Text>
        <Text style={styles.heroSubtitle}>
          Um espaço seguro para encontrar o trabalho de quem faz parte da nossa comunidade, trocar
          uma ideia no WhatsApp e salvar o contato direto na sua agenda. Valorize quem está perto de
          você.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#1E3A5F" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : services.length === 0 ? (
        <Text style={styles.empty}>
          Ainda não há serviços publicados nesta igreja. Cadastre o seu em Perfil → Ofereço meus
          Serviços.
        </Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {usedCategories.length > 1 ? (
            <DropdownSelect
              options={categoryOptions}
              selectedValue={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter((value === 'todas' || !value ? 'todas' : value) as ServiceCategoria | 'todas')
              }
              modalTitle="Categoria das atividades"
              placeholder="Categoria"
              searchPlaceholder="Buscar categoria"
              searchable
              variant="minimal"
            />
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

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  hero: {
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  heroTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
  },
  heroSubtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
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
    lineHeight: 18,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
    paddingBottom: 12,
  },
});
