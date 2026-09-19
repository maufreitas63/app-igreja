import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { ServiceMuralDetailModal } from '@/components/ServiceMuralDetailModal';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchProfileServicesMural,
  SERVICE_CATEGORIA_LABEL,
  SERVICE_CATEGORIES,
  serviceCardInitials,
  type ProfileServiceCard,
  type ServiceCategoria,
} from '@/lib/profileServicesApi';
import { resolveSelfiePreviewUrl } from '@/lib/selfie';
import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoria | null>(null);
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

  const offerersInCategory = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    return services
      .filter((card) => card.categoria === selectedCategory)
      .slice()
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'pt-BR'));
  }, [selectedCategory, services]);

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
      ) : selectedCategory ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Voltar às categorias"
          >
            <FontAwesome name="chevron-left" size={12} color={MINIMAL_UI.blueDark} />
            <Text style={styles.backText}>{SERVICE_CATEGORIA_LABEL[selectedCategory]}</Text>
          </Pressable>
          {offerersInCategory.length === 0 ? (
            <Text style={styles.empty}>Ainda não há ofertas nesta categoria.</Text>
          ) : (
            offerersInCategory.map((card) => {
              const photoUrl = photos[card.id];
              const initials = serviceCardInitials(card.fullName);

              return (
                <Pressable
                  key={card.id}
                  onPress={() => setDetail(card)}
                  style={({ pressed }) => [styles.nameRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir cartão de ${card.fullName}`}
                >
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.initials}>{initials}</Text>
                    </View>
                  )}
                  <Text style={styles.offererName} numberOfLines={2}>
                    {card.fullName}
                  </Text>
                  <FontAwesome name="qrcode" size={14} color={MINIMAL_UI.blueDark} />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.tagsContent}>
          {SERVICE_CATEGORIES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSelectedCategory(item.value)}
              style={({ pressed }) => [styles.tag, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={styles.tagText}>{item.label}</Text>
            </Pressable>
          ))}
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
    marginTop: 16,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 12,
  },
  tagsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: '#DBEAFE',
  },
  tagText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  backText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  offererName: {
    flex: 1,
    minWidth: 0,
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
