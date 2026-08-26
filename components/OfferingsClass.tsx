import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import type { OfferingsRecipientRow } from '@/lib/offeringsRecipientInfo';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const OFFERINGS_CLASS_SURFACE = '#FFFFFF';
const OFFERINGS_COPY_BUTTON_BG = '#3A96DD';
const OFFERINGS_COPY_BUTTON_TEXT = '#FFFFFF';
const OFFERINGS_COPY_BUTTON_BORDER = '#1B4F8A';

export type OfferingsClassProps = {
  title?: string;
  recipientRows: OfferingsRecipientRow[];
  pixKey?: string | null;
  pixKeyLoading?: boolean;
  onCopyPixKey?: () => void;
  onRetryLoadPixKey?: () => void;
  campaignTitle?: string | null;
  campaignHint?: string | null;
  campaignCoverUrl?: string | null;
  campaignIntegerAmount?: string;
  onCampaignIntegerAmountChange?: (value: string) => void;
  campaignFinalAmountLabel?: string | null;
  campaignCopiaECola?: string | null;
  offeringAmountMasked?: string;
  onOfferingAmountChange?: (value: string) => void;
  offeringFinalAmountLabel?: string | null;
  offeringCopiaECola?: string | null;
};

/** Visualização pura de Dízimos e Ofertas — extraída de dashboard.card.offerings. */
export function OfferingsClass({
  title = 'Dízimos e Ofertas',
  recipientRows,
  pixKey = null,
  pixKeyLoading = false,
  onCopyPixKey,
  onRetryLoadPixKey,
  campaignTitle = null,
  campaignHint = null,
  campaignCoverUrl = null,
  campaignIntegerAmount = '',
  onCampaignIntegerAmountChange,
  campaignFinalAmountLabel = null,
  campaignCopiaECola = null,
  offeringAmountMasked = '',
  onOfferingAmountChange,
  offeringFinalAmountLabel = null,
  offeringCopiaECola = null,
}: OfferingsClassProps) {
  const isCampaign = Boolean(campaignTitle);
  const copiaECola = isCampaign ? campaignCopiaECola : offeringCopiaECola;
  const qrValue = isCampaign ? campaignCopiaECola : null;
  const copyEnabled = Boolean(copiaECola || (!isCampaign && !onOfferingAmountChange && pixKey));
  const copyLabel = isCampaign ? 'Copiar Chave Pix' : 'Copiar chave PIX';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{title}</Text>

      {campaignTitle ? (
        <View style={styles.campaignBanner}>
          {campaignCoverUrl ? (
            <Image source={{ uri: campaignCoverUrl }} style={styles.campaignCover} />
          ) : null}
          <Text style={styles.campaignTitle}>{campaignTitle}</Text>
          {campaignHint ? <Text style={styles.campaignHint}>{campaignHint}</Text> : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Dados do recebedor</Text>
        <View style={styles.recipientList}>
          {recipientRows.map((row) => (
            <View key={row.label} style={styles.recipientRow}>
              <Text style={styles.recipientLabel}>{row.label}</Text>
              <Text style={styles.recipientValue} numberOfLines={3}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {isCampaign ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Valor da contribuição</Text>
          <TextInput
            style={styles.amountInput}
            value={campaignIntegerAmount}
            onChangeText={onCampaignIntegerAmountChange}
            placeholder="Ex.: 100"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            inputMode="numeric"
            accessibilityLabel="Valor em reais, sem centavos"
          />
          <Text style={styles.helpText}>
            Digite apenas o valor inteiro em reais. Os centavos de identificação são aplicados
            automaticamente.
          </Text>
          {campaignFinalAmountLabel ? (
            <View style={styles.finalAmountBox}>
              <Text style={styles.finalAmountLabel}>Valor do Pix</Text>
              <Text style={styles.finalAmountValue}>{campaignFinalAmountLabel}</Text>
            </View>
          ) : (
            <Text style={styles.helpText}>Informe o valor para gerar o Pix Copia e Cola.</Text>
          )}
        </View>
      ) : onOfferingAmountChange ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Valor da contribuição</Text>
          <TextInput
            style={styles.amountInput}
            value={offeringAmountMasked ? `R$ ${offeringAmountMasked}` : ''}
            onChangeText={onOfferingAmountChange}
            placeholder="R$ 0,00"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            inputMode="numeric"
            accessibilityLabel="Valor em reais, com centavos"
          />
          <Text style={styles.helpText}>
            Digite o valor com centavos. O montante preenche da direita para a esquerda (1 = 0,01).
          </Text>
          {offeringFinalAmountLabel ? (
            <View style={styles.finalAmountBox}>
              <Text style={styles.finalAmountLabel}>Valor do Pix</Text>
              <Text style={styles.finalAmountValue}>{offeringFinalAmountLabel}</Text>
            </View>
          ) : (
            <Text style={styles.helpText}>Informe o valor para gerar o Pix Copia e Cola.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{isCampaign ? 'Pix Copia e Cola' : 'Chave PIX'}</Text>
        {pixKeyLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} />
          </View>
        ) : pixKey ? (
          <>
            {isCampaign ? null : <Text style={styles.pixKeyValue}>{pixKey}</Text>}
            {qrValue ? (
              <View style={styles.qrWrap}>
                <QRCode value={qrValue} size={148} color="#1E3A5F" backgroundColor="#FFFFFF" />
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.copyButton, copyEnabled ? null : styles.copyButtonDisabled]}
              onPress={onCopyPixKey}
              disabled={!copyEnabled}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={copyLabel}
            >
              <MaterialIcons name="touch-app" size={28} color={OFFERINGS_COPY_BUTTON_TEXT} />
              <Text style={styles.copyButtonText}>{copyLabel}</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>
              {copiaECola || isCampaign
                ? 'Toque no botão para copiar o Pix Copia e Cola já com o valor exato e colar no aplicativo do banco.'
                : 'Toque no botão para copiar a chave e colar no aplicativo do seu banco.'}
            </Text>
          </>
        ) : (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>Chave PIX indisponível.</Text>
            {onRetryLoadPixKey ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetryLoadPixKey}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Atualizar chave PIX"
              >
                <Text style={styles.retryButtonText}>Atualizar chave PIX</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: OFFERINGS_CLASS_SURFACE,
  },
  content: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: 16,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  campaignBanner: {
    gap: 8,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
  },
  campaignCover: {
    width: '100%',
    height: 88,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  campaignTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  campaignHint: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recipientList: {
    gap: 10,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  recipientLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
    opacity: 0.88,
  },
  recipientValue: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    paddingVertical: 16,
    backgroundColor: OFFERINGS_CLASS_SURFACE,
  },
  pixKeyValue: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    backgroundColor: OFFERINGS_CLASS_SURFACE,
  },
  amountInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#1E3A5F',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: '#F8FAFC',
  },
  finalAmountBox: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  finalAmountLabel: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  finalAmountValue: {
    color: '#14532D',
    fontSize: 22,
    fontWeight: '800',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: OFFERINGS_COPY_BUTTON_BG,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: OFFERINGS_COPY_BUTTON_BORDER,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  copyButtonDisabled: {
    opacity: 0.45,
  },
  copyButtonText: {
    color: OFFERINGS_COPY_BUTTON_TEXT,
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.88,
    textAlign: 'center',
  },
  messageBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: OFFERINGS_CLASS_SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  retryButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
