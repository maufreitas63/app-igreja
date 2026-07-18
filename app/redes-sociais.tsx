import { InstanceQrCode } from '@/components/InstanceQrCode';
import { SocialBrandIcon } from '@/components/SocialBrandIcon';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { resolveInstancePublicUrl } from '@/lib/instancePublicUrl';
import { MINIMAL_ICON, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { listSessionIgrejas, getStoredTenantId, type SessionIgreja } from '@/lib/tenantSession';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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

      const url = await resolveInstancePublicUrl({ churchCode: match?.code ?? null });
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
      <Text className="w-full text-center text-minimal-section text-minimal-blue-dark bg-minimal-bg px-3 py-2.5">
        Redes Sociais
      </Text>
      <Text className="mb-6 px-4 text-center text-[13px] text-minimal-muted">
        {church?.name
          ? `Links oficiais de ${church.name}.`
          : 'Links oficiais da igreja ativa nesta sessão.'}
      </Text>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} className="mt-6" />
      ) : (
        <View className="w-full items-center">
          {hasAny ? (
            <View className="flex-row items-center justify-center gap-4 py-3">
              {websiteUrl ? (
                <TouchableOpacity
                  accessibilityLabel="Abrir site oficial"
                  accessibilityRole="button"
                  onPress={() => void openExternalUrl(websiteUrl, 'site oficial')}
                  className="h-11 w-11 items-center justify-center cursor-pointer"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-minimal-blue-dark">
                    <FontAwesome name="globe" size={MINIMAL_ICON.action} color={MINIMAL_UI.onDark} />
                  </View>
                </TouchableOpacity>
              ) : null}
              {instagramUrl ? (
                <TouchableOpacity
                  accessibilityLabel="Abrir Instagram"
                  accessibilityRole="button"
                  onPress={() => void openExternalUrl(instagramUrl, 'Instagram')}
                  className="h-11 w-11 items-center justify-center cursor-pointer"
                >
                  <SocialBrandIcon network="instagram" />
                </TouchableOpacity>
              ) : null}
              {youtubeUrl ? (
                <TouchableOpacity
                  accessibilityLabel="Abrir YouTube"
                  accessibilityRole="button"
                  onPress={() => void openExternalUrl(youtubeUrl, 'YouTube')}
                  className="h-11 w-11 items-center justify-center cursor-pointer"
                >
                  <SocialBrandIcon network="youtube" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Text className="px-6 text-center text-sm text-minimal-muted">
              Esta instância ainda não cadastrou site, Instagram ou YouTube.
            </Text>
          )}

          {instanceUrl ? <InstanceQrCode url={instanceUrl} title={church?.name} /> : null}
        </View>
      )}
    </MinimalScreenLayout>
  );
}
