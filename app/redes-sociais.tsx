import { InstanceQrCode } from '@/components/InstanceQrCode';
import { SocialBrandIcon } from '@/components/SocialBrandIcon';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { resolveInstancePublicUrl } from '@/lib/instancePublicUrl';
import { MINIMAL_ICON, MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { listSessionIgrejas, getStoredTenantId, type SessionIgreja } from '@/lib/tenantSession';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';

async function openExternalUrl(url: string, label: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.error(`Erro ao abrir ${label}:`, error);
    Alert.alert('Erro', `Não foi possível abrir o ${label} neste dispositivo.`);
  }
}

export default function RedesSociaisScreen() {
  const [loading, setLoading] = useState(true);
  const [church, setChurch] = useState<SessionIgreja | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);

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

      const url = await resolveInstancePublicUrl();
      setInstanceUrl(url);
    } catch (error) {
      console.error(error);
      setChurch(null);
      setInstanceUrl(null);
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
  const hasAny = Boolean(websiteUrl || instagramUrl || youtubeUrl);

  return (
    <MinimalScreenLayout>
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
          {hasAny ? (
            <View style={styles.row}>
              {websiteUrl ? (
                <TouchableOpacity
                  accessibilityLabel="Abrir site oficial"
                  accessibilityRole="button"
                  onPress={() => void openExternalUrl(websiteUrl, 'site oficial')}
                  style={styles.socialButton}
                >
                  <View style={styles.websiteIcon}>
                    <FontAwesome name="globe" size={MINIMAL_ICON.action} color={MINIMAL_UI.onDark} />
                  </View>
                </TouchableOpacity>
              ) : null}
              {instagramUrl ? (
                <TouchableOpacity
                  accessibilityLabel="Abrir Instagram"
                  accessibilityRole="button"
                  onPress={() => void openExternalUrl(instagramUrl, 'Instagram')}
                  style={styles.socialButton}
                >
                  <SocialBrandIcon network="instagram" />
                </TouchableOpacity>
              ) : null}
              {youtubeUrl ? (
                <TouchableOpacity
                  accessibilityLabel="Abrir YouTube"
                  accessibilityRole="button"
                  onPress={() => void openExternalUrl(youtubeUrl, 'YouTube')}
                  style={styles.socialButton}
                >
                  <SocialBrandIcon network="youtube" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Text style={styles.empty}>
              Esta instância ainda não cadastrou site, Instagram ou YouTube.
            </Text>
          )}

          {instanceUrl ? <InstanceQrCode url={instanceUrl} /> : null}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  socialButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
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
