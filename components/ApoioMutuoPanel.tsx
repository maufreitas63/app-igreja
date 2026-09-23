import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { ServiceMuralDetailModal } from '@/components/ServiceMuralDetailModal';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { computeMaintenanceContentHeight } from '@/lib/maintenanceCardStyles';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
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
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  panelHeight: number;
  isActive?: boolean;
};

const CATEGORIES_AZ = [...SERVICE_CATEGORIES].sort((left, right) =>
  left.label.localeCompare(right.label, 'pt-BR')
);

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

  useFocusEffect(
    useCallback(() => {
      if (!isActive) {
        return;
      }

      void load();
    }, [isActive, load])
  );

  const offerersByCategory = useMemo(() => {
    const grouped = new Map<ServiceCategoria, ProfileServiceCard[]>();

    for (const card of services) {
      const current = grouped.get(card.categoria) ?? [];
      current.push(card);
      grouped.set(card.categoria, current);
    }

    for (const [categoria, rows] of grouped) {
      grouped.set(
        categoria,
        rows.slice().sort((left, right) => left.fullName.localeCompare(right.fullName, 'pt-BR'))
      );
    }

    return grouped;
  }, [services]);

  const selectedOfferers = selectedCategory ? offerersByCategory.get(selectedCategory) ?? [] : [];

  return (
    <View style={[styles.panel, { maxHeight: contentHeight }]}>
      <KnowledgeSectionTitle
        title="Apoio Mútuo"
        routeKey={KNOWLEDGE_ROUTE.apoioMutuo}
        titleStyle={MINIMAL_SECTION_TITLE}
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
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.tagsContent}>
          {CATEGORIES_AZ.map((item) => {
            const hasOffer = (offerersByCategory.get(item.value)?.length ?? 0) > 0;

            return (
              <Pressable
                key={item.value}
                onPress={() => {
                  if (hasOffer) {
                    setSelectedCategory(item.value);
                  }
                }}
                disabled={!hasOffer}
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasOffer }}
                accessibilityLabel={
                  hasOffer
                    ? item.label
                    : `${item.label}, sem ofertas nesta igreja`
                }
                style={({ pressed }) => [
                  styles.tag,
                  hasOffer ? styles.tagActive : styles.tagUnused,
                  hasOffer && pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.tagText, hasOffer ? styles.tagTextActive : styles.tagTextUnused]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(selectedCategory) && !detail}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedCategory(null)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedCategory(null)}
            accessibilityLabel="Fechar lista"
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {selectedCategory ? SERVICE_CATEGORIA_LABEL[selectedCategory] : ''}
            </Text>
            <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
              {selectedOfferers.map((card) => {
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
                    <View style={styles.nameBlock}>
                      <Text style={styles.offererName} numberOfLines={1}>
                        {card.fullName}
                      </Text>
                      {card.tituloServico ? (
                        <Text style={styles.offererTitle} numberOfLines={1}>
                          {card.tituloServico}
                        </Text>
                      ) : null}
                    </View>
                    <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.blueDark} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Text style={styles.closeText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  list: {
    flex: 1,
    minHeight: 0,
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  tagActive: {
    backgroundColor: '#DBEAFE',
    borderColor: MINIMAL_UI.border,
  },
  tagUnused: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
    ...(Platform.OS === 'web' ? { cursor: 'not-allowed' as const } : null),
  },
  tagText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tagTextActive: {
    color: MINIMAL_UI.blueDark,
  },
  tagTextUnused: {
    color: '#94A3B8',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sheetTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  nameBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  offererName: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  offererTitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  close: {
    minHeight: 48,
    margin: 12,
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '800',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.88,
  },
});
