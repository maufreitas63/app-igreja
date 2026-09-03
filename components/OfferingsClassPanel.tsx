import { OfferingsClass } from '@/components/OfferingsClass';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import {
  loadOfferingsRecipientBundle,
  withRecipientInstitution,
  type OfferingsRecipientRow,
} from '@/lib/offeringsRecipientInfo';
import {
  fetchActiveCampaignProjects,
  fetchCampaignProject,
  formatCampaignCentsHint,
  formatCampaignCentsShort,
  formatCampaignProgressLabel,
  registerCampaignContributionIntent,
  type CampaignProject,
} from '@/lib/campaignProjectsApi';
import {
  pickRouteParam,
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
  withMinimalPresentation,
  withReturnDashboardCard,
  withReturnRoute,
} from '@/lib/dashboardReturnNavigation';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import {
  fetchSessionPixAccounts,
  resolvePixInstitutionForSlot,
  resolvePixKeyForSlot,
  type PixAccountsBundle,
} from '@/lib/pixAccountsApi';
import {
  brlCentsDigitsToAmount,
  buildPixCopiaECola,
  composeCampaignDonationAmount,
  formatBrlCentsDigits,
  parseBrlCentsDigits,
  parseIntegerReaisInput,
} from '@/lib/pixEmvPayload';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type OfferingsClassPanelProps = {
  onClose?: () => void;
};

/** Container com dados e ações — compõe o OfferingsClass stateless. */
export function OfferingsClassPanel({ onClose }: OfferingsClassPanelProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    campaignId?: string | string[];
    campaignContribute?: string | string[];
    returnDashboardCard?: string | string[];
    returnRoute?: string | string[];
  }>();
  const campaignId = pickRouteParam(params.campaignId);
  const campaignContribute = pickRouteParam(params.campaignContribute) === '1';
  const [recipientRows, setRecipientRows] = useState<OfferingsRecipientRow[]>([]);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [churchName, setChurchName] = useState('');
  const [pixKeyLoading, setPixKeyLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignProject | null>(null);
  const [campaignChoices, setCampaignChoices] = useState<CampaignProject[]>([]);
  const [integerAmount, setIntegerAmount] = useState('');
  const [offeringCentsDigits, setOfferingCentsDigits] = useState('');
  const [pixAccounts, setPixAccounts] = useState<PixAccountsBundle | null>(null);

  const activePixKey = useMemo(() => {
    if (campaign) {
      return (
        campaign.pix_key ||
        resolvePixKeyForSlot(pixAccounts, campaign.chave_pix_selecionada, pixKey)
      );
    }

    return resolvePixKeyForSlot(pixAccounts, pixAccounts?.defaultSlot ?? '1', pixKey);
  }, [campaign, pixAccounts, pixKey]);

  const displayRecipientRows = useMemo(() => {
    const slot = campaign?.chave_pix_selecionada ?? pixAccounts?.defaultSlot ?? '1';
    const institution =
      campaign?.pix_institution ||
      resolvePixInstitutionForSlot(
        pixAccounts,
        slot,
        recipientRows.find((row) => row.label === 'Instituição')?.value
      );

    return withRecipientInstitution(recipientRows, institution);
  }, [campaign, pixAccounts, recipientRows]);

  const campaignPix = useMemo(() => {
    if (!campaign || !activePixKey) {
      return { amount: null as number | null, copiaECola: null as string | null };
    }

    const whole = Number.parseInt(integerAmount, 10);

    if (!Number.isFinite(whole) || whole <= 0) {
      return { amount: null, copiaECola: null };
    }

    const amount = composeCampaignDonationAmount(whole, campaign.centavos_referencia);
    return {
      amount,
      copiaECola: buildPixCopiaECola({
        pixKey: activePixKey,
        amount,
        merchantName: churchName,
        description: campaign.titulo,
      }),
    };
  }, [activePixKey, campaign, churchName, integerAmount]);

  const offeringPix = useMemo(() => {
    if (campaign || !activePixKey) {
      return { amount: null as number | null, copiaECola: null as string | null };
    }

    const amount = brlCentsDigitsToAmount(offeringCentsDigits);

    if (amount == null) {
      return { amount: null, copiaECola: null };
    }

    return {
      amount,
      copiaECola: buildPixCopiaECola({
        pixKey: activePixKey,
        amount,
        merchantName: churchName,
      }),
    };
  }, [activePixKey, campaign, churchName, offeringCentsDigits]);

  const loadOfferingsInfo = useCallback(async () => {
    setPixKeyLoading(true);

    try {
      const [bundle, accounts] = await Promise.all([
        loadOfferingsRecipientBundle(),
        fetchSessionPixAccounts().catch(() => null),
      ]);
      setRecipientRows(bundle.recipientRows);
      setPixKey(bundle.pixKey);
      setChurchName(bundle.churchName);
      setPixAccounts(accounts);

      if (campaignId) {
        setCampaign(await fetchCampaignProject(campaignId));
        setCampaignChoices([]);
      } else if (campaignContribute) {
        setCampaign(null);
        setCampaignChoices(await fetchActiveCampaignProjects());
      } else {
        setCampaign(null);
        setCampaignChoices([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de dízimos/ofertas:', error);
      setRecipientRows([]);
      setPixKey(null);
      setPixAccounts(null);
      setChurchName('');
    } finally {
      setPixKeyLoading(false);
    }
  }, [campaignContribute, campaignId]);

  useFocusEffect(
    useCallback(() => {
      void loadOfferingsInfo();
    }, [loadOfferingsInfo])
  );

  const handleCopyPixKey = useCallback(async () => {
    const payload = campaign ? campaignPix.copiaECola : offeringPix.copiaECola;
    const amount = campaign ? campaignPix.amount : offeringPix.amount;

    if (!payload) {
      Alert.alert(
        activePixKey ? 'Informe o valor' : 'Chave PIX indisponível',
        activePixKey
          ? 'Digite o valor da contribuição para gerar o Pix Copia e Cola.'
          : 'Nenhuma chave PIX foi encontrada para copiar.'
      );
      return;
    }

    try {
      await Clipboard.setStringAsync(payload);

      if (campaign?.id) {
        await registerCampaignContributionIntent(campaign.id);
      }

      Toast.show({
        type: 'success',
        text1: 'Pix Copia e Cola copiado',
        text2: `Cole no aplicativo do banco. Valor: ${formatCampaignBrl(amount ?? 0)}.`,
        visibilityTime: 3500,
      });
    } catch (error) {
      console.error('Erro ao copiar chave PIX:', error);
      Alert.alert('Erro ao copiar', 'Não foi possível copiar a chave PIX.');
    }
  }, [
    campaign,
    campaignPix.amount,
    campaignPix.copiaECola,
    offeringPix.amount,
    offeringPix.copiaECola,
    activePixKey,
  ]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    router.replace({
      pathname: MEMBER_HOME_PATH,
      params: withMinimalPresentation(),
    } as Href);
  }, [onClose, router]);

  const handlePickCampaign = useCallback(
    (nextCampaign: CampaignProject) => {
      const returnRoute = resolveReturnRouteParam(params);
      const returnCard = resolveReturnDashboardCardParam(params);
      const extra = { campaignId: nextCampaign.id, campaignContribute: '1' };

      setIntegerAmount('');
      router.replace({
        pathname: '/ofertas',
        params: returnRoute
          ? withReturnRoute(returnRoute, extra)
          : returnCard
            ? withReturnDashboardCard(returnCard, extra)
            : withReturnRoute('/(tabs)', extra),
      });
    },
    [params, router]
  );

  const pickingCampaign = campaignContribute && !campaignId;

  return (
    <View style={styles.root}>
      {pickingCampaign ? (
        <ScrollView
          style={styles.picker}
          contentContainerStyle={styles.pickerContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pickerTitle}>Contribuir com uma campanha ou projeto</Text>
          <Text style={styles.pickerSubtitle}>Escolha o projeto para gerar o Pix Copia e Cola.</Text>
          {pixKeyLoading ? (
            <ActivityIndicator color="#1E3A5F" style={styles.pickerLoader} />
          ) : campaignChoices.length === 0 ? (
            <Text style={styles.pickerEmpty}>Nenhuma campanha ativa no momento.</Text>
          ) : (
            campaignChoices.map((item) => {
              const pct = Math.max(0, Math.min(100, item.progress_pct));

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.pickerCard}
                  onPress={() => handlePickCampaign(item)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Contribuir com ${item.titulo}`}
                >
                  {item.cover_url ? (
                    <Image source={{ uri: item.cover_url }} style={styles.pickerCover} />
                  ) : null}
                  <Text style={styles.pickerCardTitle}>{item.titulo}</Text>
                  {item.descricao ? (
                    <Text style={styles.pickerCardDescription} numberOfLines={3}>
                      {item.descricao}
                    </Text>
                  ) : null}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {formatCampaignProgressLabel(
                      item.valor_arrecadado,
                      item.meta_financeira,
                      item.progress_pct
                    )}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : (
        <OfferingsClass
          title={campaign ? 'Contribuir com a campanha' : 'Dízimos e Ofertas'}
          recipientRows={displayRecipientRows}
          pixKey={activePixKey}
          pixKeyLoading={pixKeyLoading}
          campaignTitle={campaign?.titulo ?? null}
          campaignHint={campaign ? formatCampaignCentsHint(campaign.centavos_referencia) : null}
          campaignCoverUrl={campaign?.cover_url ?? null}
          campaignIntegerAmount={integerAmount}
          onCampaignIntegerAmountChange={(value) => setIntegerAmount(parseIntegerReaisInput(value))}
          campaignCentsSuffix={campaign ? formatCampaignCentsShort(campaign.centavos_referencia) : null}
          campaignCopiaECola={campaignPix.copiaECola}
          offeringAmountMasked={campaign ? '' : formatBrlCentsDigits(offeringCentsDigits)}
          onOfferingAmountChange={
            campaign ? undefined : (value) => setOfferingCentsDigits(parseBrlCentsDigits(value))
          }
          offeringCopiaECola={campaign ? null : offeringPix.copiaECola}
          onCopyPixKey={() => {
            void handleCopyPixKey();
          }}
          onRetryLoadPixKey={() => {
            void loadOfferingsInfo();
          }}
        />
      )}

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
  picker: {
    flex: 1,
    minHeight: 0,
  },
  pickerContent: {
    gap: 12,
    paddingBottom: 16,
  },
  pickerTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
  },
  pickerSubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  pickerLoader: {
    marginTop: 24,
  },
  pickerEmpty: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
  },
  pickerCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  pickerCover: {
    width: '100%',
    height: 88,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  pickerCardTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  pickerCardDescription: {
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
});
