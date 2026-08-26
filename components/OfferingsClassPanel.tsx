import { OfferingsClass } from '@/components/OfferingsClass';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import {
  loadOfferingsRecipientBundle,
  type OfferingsRecipientRow,
} from '@/lib/offeringsRecipientInfo';
import {
  fetchCampaignProject,
  formatCampaignCentsHint,
  registerCampaignContributionIntent,
  type CampaignProject,
} from '@/lib/campaignProjectsApi';
import {
  buildReturnToDashboardHref,
  pickRouteParam,
  resolveReturnDashboardCardParam,
} from '@/lib/dashboardReturnNavigation';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';

type OfferingsClassPanelProps = {
  onClose?: () => void;
};

/** Container com dados e ações — compõe o OfferingsClass stateless. */
export function OfferingsClassPanel({ onClose }: OfferingsClassPanelProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    campaignId?: string | string[];
    returnDashboardCard?: string | string[];
  }>();
  const campaignId = pickRouteParam(params.campaignId);
  const [recipientRows, setRecipientRows] = useState<OfferingsRecipientRow[]>([]);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [pixKeyLoading, setPixKeyLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignProject | null>(null);

  const loadOfferingsInfo = useCallback(async () => {
    setPixKeyLoading(true);

    try {
      const bundle = await loadOfferingsRecipientBundle();
      setRecipientRows(bundle.recipientRows);
      setPixKey(bundle.pixKey);

      if (campaignId) {
        setCampaign(await fetchCampaignProject(campaignId));
      } else {
        setCampaign(null);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de dízimos/ofertas:', error);
      setRecipientRows([]);
      setPixKey(null);
    } finally {
      setPixKeyLoading(false);
    }
  }, [campaignId]);

  useFocusEffect(
    useCallback(() => {
      void loadOfferingsInfo();
    }, [loadOfferingsInfo])
  );

  const handleCopyPixKey = useCallback(async () => {
    if (!pixKey) {
      Alert.alert('Chave PIX indisponível', 'Nenhuma chave PIX foi encontrada para copiar.');
      return;
    }

    try {
      await Clipboard.setStringAsync(pixKey);

      if (campaign?.id) {
        await registerCampaignContributionIntent(campaign.id);
      }

      Toast.show({
        type: 'success',
        text1: 'Chave PIX copiada',
        text2: campaign
          ? `${formatCampaignCentsHint(campaign.centavos_referencia)}.`
          : 'Cole no aplicativo do seu banco para concluir a transferência.',
        visibilityTime: 3500,
      });
    } catch (error) {
      console.error('Erro ao copiar chave PIX:', error);
      Alert.alert('Erro ao copiar', 'Não foi possível copiar a chave PIX.');
    }
  }, [campaign, pixKey]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    const returnCard = resolveReturnDashboardCardParam(params) ?? (campaignId ? 'campaign_card' : 'offerings');
    router.replace(buildReturnToDashboardHref(returnCard));
  }, [campaignId, onClose, params, router]);

  return (
    <View style={styles.root}>
      <OfferingsClass
        title={campaign ? 'Contribuir com a campanha' : 'Dízimos e Ofertas'}
        recipientRows={recipientRows}
        pixKey={pixKey}
        pixKeyLoading={pixKeyLoading}
        campaignTitle={campaign?.titulo ?? null}
        campaignHint={campaign ? formatCampaignCentsHint(campaign.centavos_referencia) : null}
        campaignCoverUrl={campaign?.cover_url ?? null}
        onCopyPixKey={() => {
          void handleCopyPixKey();
        }}
        onRetryLoadPixKey={() => {
          void loadOfferingsInfo();
        }}
      />

      <CloseFooterBar onPress={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
