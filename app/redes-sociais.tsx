import { SocialBrandIcon } from '@/components/SocialBrandIcon';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { MINIMAL_ICON, MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { listSessionIgrejas, getStoredTenantId, type SessionIgreja } from '@/lib/tenantSession';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

async function openExternalUrl(url: string, label: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.error(`Erro ao abrir ${label}:`, error);
    Alert.alert('Erro', `Não foi possível abrir o ${label} neste dispositivo.`);
  }
}

export default function RedesSociaisScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [loading, setLoading] = useState(true);
  const [church, setChurch] = useState<SessionIgreja | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tenantId = await getStoredTenantId();
      const churches = await listSessionIgrejas();
      const match =
        (tenantId ? churches.find((row) => row.id === tenantId) : null)
        ?? churches.find((row) => row.is_primary)
        ?? churches[0]
        ?? null;
      setChurch(match);
    } catch (error) {
      console.error(error);
      setChurch(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const websiteUrl = church?.website_url?.trim() || null;
  const instagramUrl = church?.instagram_url?.trim() || null;
  const youtubeUrl = church?.youtube_url?.trim() || null;

  const socialLinks = [
    websiteUrl
      ? {
          key: 'website',
          label: 'Site',
          url: websiteUrl,
          openLabel: 'site oficial',
          accessibilityLabel: 'Abrir site oficial',
        }
      : null,
    instagramUrl
      ? {
          key: 'instagram',
          label: 'Instagram',
          url: instagramUrl,
          openLabel: 'Instagram',
          accessibilityLabel: 'Abrir Instagram',
        }
      : null,
    youtubeUrl
      ? {
          key: 'youtube',
          label: 'YouTube',
          url: youtubeUrl,
          openLabel: 'YouTube',
          accessibilityLabel: 'Abrir YouTube',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
      <Text style={styles.title}>Redes Sociais</Text>
      <Text style={styles.hint}>
        {church?.name
          ? `Links oficiais de ${church.name}.`
          : 'Links oficiais da igreja ativa nesta sessão.'}
      </Text>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : (
        <View style={styles.content}>
          {socialLinks.length > 0 ? (
            <View style={styles.list}>
              {socialLinks.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  accessibilityLabel={item.accessibilityLabel}
                  accessibilityRole="button"
                  onPress={() => void openExternalUrl(item.url, item.openLabel)}
                  style={styles.socialItem}
                >
                  {item.key === 'website' ? (
                    <View style={styles.websiteIcon}>
                      <FontAwesome name="globe" size={MINIMAL_ICON.action} color={MINIMAL_UI.onDark} />
                    </View>
                  ) : (
                    <SocialBrandIcon network={item.key} />
                  )}
                  <Text style={styles.socialLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>
              Esta instância ainda não cadastrou site, Instagram ou YouTube.
            </Text>
          )}
        </View>
      )}
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  loader: {
    marginTop: 24,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  list: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    gap: 28,
    paddingTop: 12,
    paddingBottom: 24,
  },
  socialItem: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  socialLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  websiteIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
